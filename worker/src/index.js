// Ambassador dashboard: one Worker serving the API, the static UI, and a daily backup.
//
// Rules this file enforces (carried over from the first version, do not loosen):
// - AI drafts, a person approves. Nothing reaches a network before the ambassador approved it.
// - The review link is the ambassador's only credential: a random token that opens exactly one
//   post and has no path to anything else. Pending links expire; approved ones stay readable so
//   the ambassador can come back and copy the text.
// - An approved post is never overwritten by reopening its link. Only "send for approval again"
//   from the dashboard reopens it.
// - Question ids are permanent.
// - Nothing is indexed by search engines.
import { generateVariants, scoreVariants, personaDraft, voiceLesson, noEmDash } from './ai.js';
import { QUESTIONNAIRE_SECTIONS, TOTAL_QUESTIONS } from '../public/questionnaire.js';

const DAY = 86_400_000;
const SESSION_DAYS = 30;
const REVIEW_LINK_DAYS = 14;
const LOGIN_MAX = 5;
const LOGIN_LOCK_MS = 15 * 60_000;
const SUBMIT_MAX_PER_HOUR = 5;
const BACKUP_KEEP = 60;

// ---------- small helpers ----------
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}
const bad = (msg, status = 400) => json({ error: msg }, status);

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

async function body(request) {
  try { return await request.json(); } catch { fail(400, 'הבקשה לא תקינה'); }
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
function randomToken(bytes = 16) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}
async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
async function hmac(keyText, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(keyText), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}
// Constant-time comparison of two strings via their digests.
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// Only Latin letters and digits survive: a Hebrew slug becomes URL-encoded noise.
export function slugify(input) {
  return String(input || '').trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}
async function uniqueSlug(env, table, base) {
  let slug = base || `item-${randomToken(3)}`;
  for (let i = 2; ; i++) {
    const row = await env.DB.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`).bind(slug).first();
    if (!row) return slug;
    slug = `${base}-${i}`;
  }
}

// Minimal frontmatter reader, enough for the persona profile header.
export function frontmatter(md) {
  const m = String(md || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const data = {};
  if (!m) return data;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return data;
}

function personalityWords(md) {
  const m = String(md || '').match(/## Personality in 5 Words\s*\n+([^\n#]+)/);
  return m ? m[1].trim() : '';
}

// ---------- activity log and notifications ----------
async function logActivity(env, kind, message, link = null) {
  await env.DB.prepare('INSERT INTO activity (at, kind, message, link) VALUES (?, ?, ?, ?)').bind(nowIso(), kind, message, link).run();
}

// Email goes out only when a sender is configured. The activity log works either way,
// so nothing is lost before email is set up.
async function notify(env, subject, text, link) {
  if (!env.BREVO_API_KEY || !env.NOTIFY_EMAIL) return;
  const base = env.PUBLIC_URL || '';
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: env.NOTIFY_FROM || env.NOTIFY_EMAIL, name: 'שגרירי כללית' },
      to: [{ email: env.NOTIFY_EMAIL }],
      subject,
      textContent: `${text}${link ? `\n\n${base}${link}` : ''}`,
    }),
  }).catch(() => {});
}

async function event(env, ctx, kind, message, link, mail) {
  await logActivity(env, kind, message, link);
  if (mail) ctx.waitUntil(notify(env, message, mail, link));
}

// ---------- throttling ----------
async function throttleState(env, key) {
  return env.DB.prepare('SELECT count, window_start, locked_until FROM throttle WHERE key = ?').bind(key).first();
}
async function bump(env, key, windowMs, max, lockMs) {
  const t = Date.now();
  const row = await throttleState(env, key);
  let count = 1, start = t, locked = 0;
  if (row && t - row.window_start < windowMs) { count = row.count + 1; start = row.window_start; }
  if (lockMs && count >= max) locked = t + lockMs;
  await env.DB.prepare('INSERT INTO throttle (key, count, window_start, locked_until) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start, locked_until = excluded.locked_until')
    .bind(key, count, start, locked).run();
  return { count, locked };
}

// ---------- session ----------
// The cookie carries an expiry and a signature, never the password. The signature covers a
// digest of the current password, so changing the password signs everyone out.
async function sessionKey(env) {
  if (!env.DASHBOARD_PASSWORD) fail(500, 'לא הוגדרה סיסמה לאתר');
  return `${env.SESSION_SECRET || ''}|${await sha256(env.DASHBOARD_PASSWORD)}`;
}
async function makeSession(env) {
  const exp = Date.now() + SESSION_DAYS * DAY;
  return `${exp}.${await hmac(await sessionKey(env), `v1.${exp}`)}`;
}
async function isAuthed(request, env) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)amb_s=([^;]+)/);
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(await sessionKey(env), `v1.${exp}`));
}
const cookieHeader = (value, maxAge) => `amb_s=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

async function login(request, env) {
  const key = `login:${clientIp(request)}`;
  const row = await throttleState(env, key);
  if (row && row.locked_until > Date.now()) {
    const minutes = Math.ceil((row.locked_until - Date.now()) / 60_000);
    return bad(`יותר מדי ניסיונות שגויים. אפשר לנסות שוב בעוד ${minutes} דקות`, 429);
  }
  const { password } = await body(request);
  if (!env.DASHBOARD_PASSWORD) return bad('לא הוגדרה סיסמה לאתר', 500);
  if (!(await safeEqual(password || '', env.DASHBOARD_PASSWORD))) {
    const { count, locked } = await bump(env, key, LOGIN_LOCK_MS, LOGIN_MAX, LOGIN_LOCK_MS);
    if (locked) return bad('יותר מדי ניסיונות שגויים. הכניסה ננעלה ל-15 דקות', 429);
    return bad(`הסיסמה שגויה. נשארו ${LOGIN_MAX - count} ניסיונות לפני נעילה`, 401);
  }
  await env.DB.prepare('DELETE FROM throttle WHERE key = ?').bind(key).run();
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader(await makeSession(env), SESSION_DAYS * 86400) });
}

// ---------- data access ----------
async function samplesFor(env, slug) {
  const { results } = await env.DB.prepare('SELECT id, filename, content FROM samples WHERE persona_slug = ? ORDER BY filename').bind(slug).all();
  return results;
}
async function personaFull(env, slug) {
  const p = await env.DB.prepare('SELECT * FROM personas WHERE slug = ?').bind(slug).first();
  if (!p) return null;
  return { ...p, samples: await samplesFor(env, slug) };
}
function personaOut(p) {
  return {
    slug: p.slug, name: p.name, role: p.role, company: p.company, trainingStatus: p.training_status,
    origin: p.origin, personalityWords: personalityWords(p.profile_md),
    image: p.image_key ? `/api/media/${encodeURIComponent(p.image_key)}?v=${encodeURIComponent(p.updated_at)}` : null,
    video: p.video_key ? `/api/media/${encodeURIComponent(p.video_key)}` : null,
    updatedAt: p.updated_at,
  };
}
function postOut(p, base = '') {
  const expired = p.status === 'pending' && p.token_expires_at && p.token_expires_at < nowIso();
  return {
    id: p.id, personaSlug: p.persona_slug, personaName: p.persona_name, topic: p.topic, platform: p.platform, goal: p.goal,
    body: p.body, originalBody: p.original_body, edited: !!p.edited, status: p.status,
    reviewUrl: p.token ? `${base}/review/${p.token}` : null, linkExpired: !!expired, tokenExpiresAt: p.token_expires_at,
    sentAt: p.sent_at, approvedAt: p.approved_at, scheduledFor: p.scheduled_for,
    publishedAt: p.published_at, publishedUrl: p.published_url,
    voiceScore: p.voice_score, voiceReason: p.voice_reason, topicId: p.topic_id, createdAt: p.created_at,
  };
}
function candidateOut(c, full = false) {
  const out = {
    slug: c.slug, name: c.name, englishName: c.english_name, role: c.role, company: c.company,
    status: c.status, submittedAt: c.submitted_at, answeredCount: c.answered_count, totalQuestions: TOTAL_QUESTIONS,
  };
  if (full) { out.email = c.email; out.answers = JSON.parse(c.answers_json || '{}'); }
  return out;
}

const POST_SELECT = 'SELECT posts.*, personas.name AS persona_name FROM posts LEFT JOIN personas ON personas.slug = posts.persona_slug';

async function postById(env, id) {
  const p = await env.DB.prepare(`${POST_SELECT} WHERE posts.id = ?`).bind(id).first();
  if (!p) fail(404, 'הפוסט לא נמצא');
  return p;
}

// ---------- backup ----------
const TABLES = ['personas', 'samples', 'candidates', 'posts', 'topics', 'activity'];

async function buildSnapshot(env) {
  const tables = {};
  for (const t of TABLES) tables[t] = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results;
  return { version: 2, createdAt: nowIso(), source: 'ambassador-worker', tables };
}
function snapshotStats(s) {
  return { personas: s.tables.personas.length, candidates: s.tables.candidates.length, posts: s.tables.posts.length, topics: s.tables.topics.length };
}
// Merge only: rows that already exist are kept. Importing an old backup can never erase newer work.
async function restoreSnapshot(env, snap) {
  if (!snap || snap.version !== 2 || !snap.tables) fail(400, 'הקובץ אינו קובץ גיבוי של האתר הזה');
  let written = 0;
  for (const t of TABLES) {
    const rows = snap.tables[t] || [];
    const stmts = rows.map((r) => {
      const cols = Object.keys(r).filter((c) => /^[a-z_]+$/.test(c));
      return env.DB.prepare(`INSERT OR IGNORE INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map((c) => r[c]));
    });
    for (let i = 0; i < stmts.length; i += 50) {
      const res = await env.DB.batch(stmts.slice(i, i + 50));
      written += res.reduce((n, x) => n + (x.meta?.changes || 0), 0);
    }
  }
  return written;
}
async function backupToR2(env) {
  const snap = await buildSnapshot(env);
  const key = `backups/${snap.createdAt.slice(0, 10)}.json`;
  await env.MEDIA.put(key, JSON.stringify(snap), { httpMetadata: { contentType: 'application/json' } });
  const listed = await env.MEDIA.list({ prefix: 'backups/' });
  const keys = listed.objects.map((o) => o.key).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - BACKUP_KEEP))) await env.MEDIA.delete(old);
  return { key, ...snapshotStats(snap) };
}

// ---------- public routes (no session) ----------
async function publicConfig(env) {
  return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null, sections: QUESTIONNAIRE_SECTIONS.length, totalQuestions: TOTAL_QUESTIONS });
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET); form.append('response', token || ''); form.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  return (await r.json()).success === true;
}

async function submitCandidate(request, env, ctx) {
  const ip = clientIp(request);
  const data = await body(request);
  // Honeypot: a field real people never see. Bots fill it; pretend success and keep nothing.
  if (data.website) return json({ ok: true });
  const { count } = await bump(env, `cand:${ip}`, 3_600_000, SUBMIT_MAX_PER_HOUR, 0);
  if (count > SUBMIT_MAX_PER_HOUR) return bad('נשלחו יותר מדי שאלונים מהרשת הזו בשעה האחרונה. אפשר לנסות שוב מאוחר יותר', 429);
  if (!(await verifyTurnstile(env, data.turnstile, ip))) return bad('בדיקת האבטחה לא עברה. אפשר לרענן את הדף ולנסות שוב', 403);

  const name = String(data.name || '').trim().slice(0, 120);
  const englishName = String(data.englishName || '').trim().slice(0, 120);
  if (!name) return bad('חסר שם');
  const valid = new Set(QUESTIONNAIRE_SECTIONS.flatMap((s) => s.questions.map((q) => q.id)));
  const answers = {};
  for (const [k, v] of Object.entries(data.answers || {})) if (valid.has(k) && typeof v === 'string') answers[k] = v.slice(0, 20000);
  const answered = Object.values(answers).filter((a) => a.trim()).length;

  const slug = await uniqueSlug(env, 'candidates', slugify(englishName) || slugify(name) || `candidate-${randomToken(3)}`);
  await env.DB.prepare('INSERT INTO candidates (slug, name, english_name, role, company, email, answers_json, answered_count, status, submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(slug, name, englishName, String(data.role || '').slice(0, 200), String(data.company || '').slice(0, 200), String(data.email || '').slice(0, 200), JSON.stringify(answers), answered, 'new', nowIso()).run();
  await event(env, ctx, 'candidate', `מועמד/ת חדש/ה מילא/ה שאלון: ${name} (${answered} מתוך ${TOTAL_QUESTIONS} תשובות)`, `/candidates/${slug}`, 'שאלון חדש התקבל באתר השגרירים.');
  return json({ ok: true });
}

async function reviewTarget(env, token) {
  if (!/^[a-f0-9]{32}$/.test(token || '')) return null;
  return env.DB.prepare(`${POST_SELECT} WHERE posts.token = ?`).bind(token).first();
}

// Exactly one post, and only what the ambassador needs. No ids, no links to anything else.
async function getReview(env, token) {
  const p = await reviewTarget(env, token);
  if (!p) return json({ state: 'invalid' }, 404);
  const base = { personaName: p.persona_name, topic: p.topic, platform: p.platform, body: p.body };
  if (p.status === 'approved') return json({ state: 'approved', ...base, edited: !!p.edited, publishedUrl: p.published_url });
  if (p.status !== 'pending') return json({ state: 'invalid' }, 404);
  if (p.token_expires_at && p.token_expires_at < nowIso()) return json({ state: 'expired', personaName: p.persona_name }, 410);
  return json({ state: 'pending', ...base });
}

async function approveReview(request, env, ctx, token) {
  const { count } = await bump(env, `rev:${clientIp(request)}`, 3_600_000, 60, 0);
  if (count > 60) return bad('יותר מדי בקשות, אפשר לנסות שוב בעוד שעה', 429);
  const p = await reviewTarget(env, token);
  if (!p) return bad('הקישור אינו תקף', 404);
  // A settled decision is not reopened by its link.
  if (p.status === 'approved') return json({ ok: true, edited: !!p.edited, body: p.body });
  if (p.status !== 'pending') return bad('הקישור אינו תקף', 404);
  if (p.token_expires_at && p.token_expires_at < nowIso()) return bad('תוקף הקישור פג. אפשר לבקש קישור חדש ממי ששלח/ה אותו', 410);

  const { content } = await body(request);
  const submitted = noEmDash(String(content || '').trim());
  if (!submitted) return bad('הפוסט ריק');
  const original = p.body.trim();
  const edited = submitted !== original;
  const t = nowIso();
  // The guarded UPDATE makes a double click or two open tabs harmless.
  const res = await env.DB.prepare("UPDATE posts SET status = 'approved', body = ?, original_body = ?, edited = ?, approved_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'")
    .bind(edited ? submitted : original, edited ? original : null, edited ? 1 : 0, t, t, p.id).run();
  if (res.meta.changes) {
    await event(env, ctx, 'approved', `${p.persona_name} אישר/ה פוסט${edited ? ' עם שינויים' : ''}: ${p.topic}`, `/personas/${p.persona_slug}`, 'פוסט אושר באתר השגרירים.');
  }
  return json({ ok: true, edited, body: edited ? submitted : original });
}

async function reviewPublished(request, env, ctx, token) {
  const p = await reviewTarget(env, token);
  if (!p || p.status !== 'approved') return bad('אפשר לסמן פרסום רק אחרי אישור', 400);
  const { url } = await body(request);
  let clean;
  try { const u = new URL(String(url || '').trim()); if (!/^https?:$/.test(u.protocol)) throw 0; clean = u.toString(); } catch { return bad('זה לא נראה כמו קישור. צריך להדביק את הכתובת של הפוסט'); }
  await env.DB.prepare('UPDATE posts SET published_url = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?').bind(clean.slice(0, 600), nowIso(), nowIso(), p.id).run();
  await event(env, ctx, 'published', `${p.persona_name} פרסם/ה פוסט: ${p.topic}`, `/personas/${p.persona_slug}`, null);
  return json({ ok: true });
}

// ---------- admin routes ----------
async function dashboard(env) {
  const personas = (await env.DB.prepare('SELECT * FROM personas ORDER BY created_at').all()).results;
  const counts = (await env.DB.prepare("SELECT persona_slug, status, COUNT(*) n, SUM(CASE WHEN published_url IS NOT NULL OR published_at IS NOT NULL THEN 1 ELSE 0 END) pub FROM posts GROUP BY persona_slug, status").all()).results;
  const per = {};
  for (const c of counts) {
    const o = (per[c.persona_slug] ||= { draft: 0, pending: 0, approved: 0, published: 0 });
    o[c.status] = c.n; o.published += c.pub || 0;
  }
  const t = today();
  const in14 = new Date(Date.now() + 14 * DAY).toISOString().slice(0, 10);
  const in45 = new Date(Date.now() + 45 * DAY).toISOString().slice(0, 10);
  const pending = (await env.DB.prepare(`${POST_SELECT} WHERE posts.status = 'pending' ORDER BY posts.sent_at`).all()).results;
  const upcoming = (await env.DB.prepare(`${POST_SELECT} WHERE posts.scheduled_for BETWEEN ? AND ? ORDER BY posts.scheduled_for`).bind(t, in14).all()).results;
  const topics = (await env.DB.prepare('SELECT * FROM topics WHERE date BETWEEN ? AND ? ORDER BY date LIMIT 8').bind(t, in45).all()).results;
  const newCandidates = (await env.DB.prepare("SELECT COUNT(*) n FROM candidates WHERE status = 'new'").first()).n;
  const activity = (await env.DB.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 8').all()).results;
  return json({
    personas: personas.map((p) => ({ ...personaOut(p), posts: per[p.slug] || { draft: 0, pending: 0, approved: 0, published: 0 } })),
    pending: pending.map((p) => postOut(p)), upcoming: upcoming.map((p) => postOut(p)), topics, newCandidates, activity,
  });
}

async function createPost(request, env) {
  const d = await body(request);
  const persona = await env.DB.prepare('SELECT slug FROM personas WHERE slug = ?').bind(d.personaSlug || '').first();
  if (!persona) fail(404, 'השגריר/ה לא נמצא/ה');
  const text = noEmDash(String(d.body || '').trim());
  if (!text) fail(400, 'הפוסט ריק');
  const t = nowIso();
  const filename = `${t.slice(0, 10)}_${randomToken(4)}.md`;
  const r = await env.DB.prepare('INSERT INTO posts (persona_slug, filename, topic, platform, goal, body, status, scheduled_for, voice_score, voice_reason, topic_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(persona.slug, filename, String(d.topic || '').slice(0, 300), String(d.platform || ''), String(d.goal || '').slice(0, 300), text, 'draft', d.scheduledFor || null,
      Number.isInteger(d.voiceScore) ? d.voiceScore : null, d.voiceReason || null, d.topicId || null, t, t).run();
  return json({ ok: true, id: r.meta.last_row_id });
}

async function updatePost(request, env, id) {
  const p = await postById(env, id);
  const d = await body(request);
  const sets = [], vals = [];
  if (typeof d.body === 'string') {
    // After approval the text is the ambassador's. Editing it here would publish words they never saw.
    if (p.status === 'approved') fail(409, 'הפוסט כבר אושר. כדי לשנות אותו צריך לשלוח לאישור מחדש');
    sets.push('body = ?'); vals.push(noEmDash(d.body.trim()));
  }
  if ('scheduledFor' in d) { sets.push('scheduled_for = ?'); vals.push(/^\d{4}-\d{2}-\d{2}$/.test(d.scheduledFor || '') ? d.scheduledFor : null); }
  if ('publishedUrl' in d) {
    let url = null;
    if (d.publishedUrl) { try { const u = new URL(d.publishedUrl); if (!/^https?:$/.test(u.protocol)) throw 0; url = u.toString(); } catch { fail(400, 'הקישור לפוסט לא תקין'); } }
    sets.push('published_url = ?'); vals.push(url);
    sets.push('published_at = ?'); vals.push(url || d.published ? (p.published_at || nowIso()) : null);
  } else if ('published' in d) { sets.push('published_at = ?'); vals.push(d.published ? (p.published_at || nowIso()) : null); }
  if (!sets.length) return json({ ok: true });
  sets.push('updated_at = ?'); vals.push(nowIso());
  await env.DB.prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id).run();
  return json({ ok: true });
}

// Moves a post to "waiting for the ambassador". The existing token is kept, so a link already
// sent keeps working, and its expiry is renewed. On an approved post this is the one deliberate
// way to reopen it.
async function sendForApproval(env, ctx, id, base) {
  const p = await postById(env, id);
  const token = p.token || randomToken(16);
  const exp = new Date(Date.now() + REVIEW_LINK_DAYS * DAY).toISOString();
  await env.DB.prepare("UPDATE posts SET status = 'pending', token = ?, token_expires_at = ?, sent_at = ?, updated_at = ? WHERE id = ?").bind(token, exp, nowIso(), nowIso(), id).run();
  await logActivity(env, 'sent', `נשלח לאישור של ${p.persona_name}: ${p.topic}`, `/personas/${p.persona_slug}`);
  return json({ ok: true, reviewUrl: `${base}/review/${token}`, expiresAt: exp });
}

async function generate(request, env) {
  const d = await body(request);
  const slugs = Array.isArray(d.personaSlugs) ? d.personaSlugs.slice(0, 6) : [];
  if (!slugs.length || !d.topic || !d.platform) fail(400, 'צריך לבחור שגריר/ה, פלטפורמה ונושא');
  let context = '';
  if (d.topicId) {
    const topic = await env.DB.prepare('SELECT * FROM topics WHERE id = ?').bind(d.topicId).first();
    if (topic) context = [topic.title, topic.date, topic.angle, topic.notes].filter(Boolean).join(' · ');
  }
  const results = await Promise.all(slugs.map(async (slug) => {
    const persona = await personaFull(env, slug);
    if (!persona) return { slug, error: 'השגריר/ה לא נמצא/ה' };
    try {
      const variants = await generateVariants(env, persona, { platform: d.platform, topic: d.topic, angle: d.angle, tone: d.tone, context });
      let scores = variants.map(() => ({ score: null, reason: '' }));
      try { scores = await scoreVariants(env, persona, variants); } catch { /* the variants are still usable without a score */ }
      return { slug, name: persona.name, variants: variants.map((v, i) => ({ ...v, ...scores[i] })) };
    } catch (e) {
      return { slug, name: persona.name, error: e.message || 'היצירה נכשלה' };
    }
  }));
  return json({ results });
}

async function savePersonaFromCandidate(request, env, ctx, slug) {
  const c = await env.DB.prepare('SELECT * FROM candidates WHERE slug = ?').bind(slug).first();
  if (!c) fail(404, 'המועמד/ת לא נמצא/ה');
  const { profileMarkdown } = await body(request);
  const md = noEmDash(String(profileMarkdown || '').trim());
  if (!md) fail(400, 'הטיוטה ריקה');
  const fm = frontmatter(md);
  const pslug = await uniqueSlug(env, 'personas', slugify(c.english_name) || slugify(c.name) || `persona-${randomToken(3)}`);
  const t = nowIso();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO personas (slug, name, english_name, role, company, profile_md, training_status, origin, candidate_slug, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(pslug, fm.name || c.name, c.english_name, fm.role || c.role, fm.company || c.company, md, fm['training-status'] || 'draft', 'app', c.slug, t, t),
    env.DB.prepare("UPDATE candidates SET status = 'persona-created' WHERE slug = ?").bind(c.slug),
  ]);
  await logActivity(env, 'persona', `נוצרה פרסונה חדשה: ${fm.name || c.name}`, `/personas/${pslug}`);
  return json({ ok: true, slug: pslug });
}

async function updatePersona(request, env, slug) {
  const p = await env.DB.prepare('SELECT * FROM personas WHERE slug = ?').bind(slug).first();
  if (!p) fail(404, 'השגריר/ה לא נמצא/ה');
  const { profileMarkdown } = await body(request);
  const md = noEmDash(String(profileMarkdown || '').trim());
  if (!md) fail(400, 'הפרופיל ריק');
  const fm = frontmatter(md);
  await env.DB.prepare('UPDATE personas SET profile_md = ?, name = ?, role = ?, company = ?, training_status = ?, updated_at = ? WHERE slug = ?')
    .bind(md, fm.name || p.name, fm.role || p.role, fm.company || p.company, fm['training-status'] || p.training_status, nowIso(), slug).run();
  return json({ ok: true });
}

const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
async function uploadImage(request, env, slug) {
  const p = await env.DB.prepare('SELECT * FROM personas WHERE slug = ?').bind(slug).first();
  if (!p) fail(404, 'השגריר/ה לא נמצא/ה');
  const form = await request.formData();
  const file = form.get('image');
  if (!file || typeof file === 'string') fail(400, 'לא נבחרה תמונה');
  if (file.size > 8 * 1024 * 1024) fail(400, 'התמונה גדולה מדי, עד 8MB');
  const ext = IMAGE_TYPES[file.type];
  if (!ext) fail(400, 'אפשר להעלות PNG, JPG או WEBP');
  const key = `personas/${slug}/photo-${Date.now()}.${ext}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  if (p.image_key) await env.MEDIA.delete(p.image_key);
  await env.DB.prepare('UPDATE personas SET image_key = ?, updated_at = ? WHERE slug = ?').bind(key, nowIso(), slug).run();
  return json({ ok: true });
}

async function media(env, key, request) {
  if (!key.startsWith('personas/')) fail(404, 'לא נמצא');
  const range = request.headers.get('range');
  const obj = await env.MEDIA.get(key, range ? { range: request.headers } : undefined);
  if (!obj) fail(404, 'לא נמצא');
  const headers = new Headers({ 'cache-control': 'private, max-age=86400', 'accept-ranges': 'bytes' });
  obj.writeHttpMetadata(headers);
  if (range && obj.range) {
    const { offset = 0, length = obj.size - offset } = obj.range;
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set('content-length', String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(obj.body, { headers });
}

async function calendar(env, url) {
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : today().slice(0, 7);
  const from = `${month}-01`, to = `${month}-31`;
  const posts = (await env.DB.prepare(`${POST_SELECT} WHERE (posts.scheduled_for BETWEEN ? AND ?) OR (substr(posts.published_at,1,10) BETWEEN ? AND ?) ORDER BY posts.scheduled_for`).bind(from, to, from, to).all()).results;
  const topics = (await env.DB.prepare('SELECT * FROM topics WHERE date BETWEEN ? AND ? ORDER BY date').bind(from, to).all()).results;
  const unscheduled = (await env.DB.prepare(`${POST_SELECT} WHERE posts.scheduled_for IS NULL AND posts.published_at IS NULL AND posts.status != 'draft' ORDER BY posts.updated_at DESC LIMIT 30`).all()).results;
  return json({ month, posts: posts.map((p) => postOut(p)), topics, unscheduled: unscheduled.map((p) => postOut(p)) });
}

async function topicSave(request, env, id) {
  const d = await body(request);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : null;
  const title = String(d.title || '').trim().slice(0, 200);
  if (!date || !title) fail(400, 'צריך תאריך ושם לנושא');
  const kind = ['holiday', 'event', 'campaign', 'other'].includes(d.kind) ? d.kind : 'other';
  const angle = noEmDash(String(d.angle || '').slice(0, 500)), notes = noEmDash(String(d.notes || '').slice(0, 2000));
  if (id) await env.DB.prepare('UPDATE topics SET date = ?, title = ?, kind = ?, angle = ?, notes = ? WHERE id = ?').bind(date, title, kind, angle, notes, id).run();
  else await env.DB.prepare('INSERT INTO topics (date, title, kind, angle, notes, created_at) VALUES (?,?,?,?,?,?)').bind(date, title, kind, angle, notes, nowIso()).run();
  return json({ ok: true });
}

// ---------- router ----------
async function admin(request, env, ctx, url) {
  const { pathname: p } = url;
  const m = request.method;
  const base = url.origin;
  let r;

  if (p === '/api/me') return json({ ok: true });
  if (p === '/api/dashboard') return dashboard(env);

  if (p === '/api/personas' && m === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM personas ORDER BY created_at').all()).results;
    return json(rows.map(personaOut));
  }
  if ((r = p.match(/^\/api\/personas\/([a-z0-9-]+)$/))) {
    const slug = r[1];
    if (m === 'GET') {
      const pf = await personaFull(env, slug);
      if (!pf) fail(404, 'השגריר/ה לא נמצא/ה');
      const posts = (await env.DB.prepare(`${POST_SELECT} WHERE posts.persona_slug = ? ORDER BY posts.created_at DESC`).bind(slug).all()).results;
      return json({ ...personaOut(pf), profileMarkdown: pf.profile_md, samples: pf.samples, posts: posts.map((x) => postOut(x, base)) });
    }
    if (m === 'PATCH') return updatePersona(request, env, slug);
    if (m === 'DELETE') {
      const pf = await env.DB.prepare('SELECT * FROM personas WHERE slug = ?').bind(slug).first();
      if (!pf) fail(404, 'השגריר/ה לא נמצא/ה');
      // Posts stay: they are the record of what was published in this person's name.
      await env.DB.batch([env.DB.prepare('DELETE FROM samples WHERE persona_slug = ?').bind(slug), env.DB.prepare('DELETE FROM personas WHERE slug = ?').bind(slug)]);
      for (const k of [pf.image_key, pf.video_key].filter(Boolean)) await env.MEDIA.delete(k);
      await logActivity(env, 'persona', `נמחקה פרסונה: ${pf.name}`);
      return json({ ok: true });
    }
  }
  if ((r = p.match(/^\/api\/personas\/([a-z0-9-]+)\/image$/)) && m === 'POST') return uploadImage(request, env, r[1]);
  if ((r = p.match(/^\/api\/personas\/([a-z0-9-]+)\/samples$/)) && m === 'POST') {
    const d = await body(request);
    const content = noEmDash(String(d.content || '').trim());
    if (!content) fail(400, 'הדוגמה ריקה');
    if (!(await env.DB.prepare('SELECT 1 FROM personas WHERE slug = ?').bind(r[1]).first())) fail(404, 'השגריר/ה לא נמצא/ה');
    await env.DB.prepare('INSERT INTO samples (persona_slug, filename, content) VALUES (?,?,?)').bind(r[1], `sample-${Date.now()}.md`, content).run();
    return json({ ok: true });
  }
  if ((r = p.match(/^\/api\/samples\/(\d+)$/)) && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM samples WHERE id = ?').bind(Number(r[1])).run();
    return json({ ok: true });
  }

  if (p === '/api/candidates' && m === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM candidates ORDER BY submitted_at DESC').all()).results;
    return json(rows.map((c) => candidateOut(c)));
  }
  if ((r = p.match(/^\/api\/candidates\/([a-z0-9-]+)$/))) {
    const slug = r[1];
    const c = await env.DB.prepare('SELECT * FROM candidates WHERE slug = ?').bind(slug).first();
    if (!c) fail(404, 'המועמד/ת לא נמצא/ה');
    if (m === 'GET') return json(candidateOut(c, true));
    if (m === 'PATCH') {
      const { status } = await body(request);
      if (!['new', 'reviewed', 'persona-created', 'rejected'].includes(status)) fail(400, 'סטטוס לא מוכר');
      await env.DB.prepare('UPDATE candidates SET status = ? WHERE slug = ?').bind(status, slug).run();
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      // Full deletion on request: the answers and the contact details. A persona already built
      // from them is a separate decision and is not touched here.
      await env.DB.prepare('DELETE FROM candidates WHERE slug = ?').bind(slug).run();
      await logActivity(env, 'candidate', 'נמחקו תשובות של מועמד/ת לפי בקשה');
      return json({ ok: true });
    }
  }
  if ((r = p.match(/^\/api\/candidates\/([a-z0-9-]+)\/persona-draft$/)) && m === 'POST') {
    const c = await env.DB.prepare('SELECT * FROM candidates WHERE slug = ?').bind(r[1]).first();
    if (!c) fail(404, 'המועמד/ת לא נמצא/ה');
    if (!c.answered_count) fail(400, 'אין עדיין תשובות, אי אפשר לבנות טיוטה');
    const draft = await personaDraft(env, { name: c.name, role: c.role, company: c.company, answers: JSON.parse(c.answers_json) });
    return json({ draft });
  }
  if ((r = p.match(/^\/api\/candidates\/([a-z0-9-]+)\/save-persona$/)) && m === 'POST') return savePersonaFromCandidate(request, env, ctx, r[1]);

  if (p === '/api/generate' && m === 'POST') return generate(request, env);
  if (p === '/api/posts' && m === 'POST') return createPost(request, env);
  if ((r = p.match(/^\/api\/posts\/(\d+)$/))) {
    const id = Number(r[1]);
    if (m === 'PATCH') return updatePost(request, env, id);
    if (m === 'DELETE') { await postById(env, id); await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run(); return json({ ok: true }); }
  }
  if ((r = p.match(/^\/api\/posts\/(\d+)\/send$/)) && m === 'POST') return sendForApproval(env, ctx, Number(r[1]), base);
  if ((r = p.match(/^\/api\/posts\/(\d+)\/lesson$/)) && m === 'POST') {
    const post = await postById(env, Number(r[1]));
    if (!post.original_body) fail(400, 'הפוסט אושר בלי עריכה, אין מה להשוות');
    const persona = await personaFull(env, post.persona_slug);
    if (!persona) fail(404, 'השגריר/ה לא נמצא/ה');
    return json({ lesson: await voiceLesson(env, persona, post.original_body, post.body) });
  }

  if (p === '/api/calendar') return calendar(env, url);
  if (p === '/api/topics' && m === 'GET') {
    const from = url.searchParams.get('from') || today();
    return json((await env.DB.prepare('SELECT * FROM topics WHERE date >= ? ORDER BY date LIMIT 200').bind(from).all()).results);
  }
  if (p === '/api/topics' && m === 'POST') return topicSave(request, env, null);
  if ((r = p.match(/^\/api\/topics\/(\d+)$/))) {
    if (m === 'PATCH') return topicSave(request, env, Number(r[1]));
    if (m === 'DELETE') { await env.DB.prepare('DELETE FROM topics WHERE id = ?').bind(Number(r[1])).run(); return json({ ok: true }); }
  }

  if (p === '/api/activity') {
    return json((await env.DB.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 200').all()).results);
  }

  if (p === '/api/backup/export') {
    const snap = await buildSnapshot(env);
    const s = snapshotStats(snap);
    return new Response(JSON.stringify(snap), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="ambassador-backup-${snap.createdAt.slice(0, 10)}.json"`,
        'x-backup-personas': String(s.personas), 'x-backup-candidates': String(s.candidates), 'x-backup-posts': String(s.posts),
      },
    });
  }
  if (p === '/api/backup/status') {
    const listed = await env.MEDIA.list({ prefix: 'backups/' });
    const items = listed.objects.map((o) => ({ name: o.key.slice(8), size: o.size, uploaded: o.uploaded })).sort((a, b) => b.name.localeCompare(a.name));
    return json({ current: snapshotStats(await buildSnapshot(env)), backups: items.slice(0, 30) });
  }
  if (p === '/api/backup/run' && m === 'POST') return json(await backupToR2(env));
  if ((r = p.match(/^\/api\/backup\/file\/(\d{4}-\d{2}-\d{2}\.json)$/))) {
    const obj = await env.MEDIA.get(`backups/${r[1]}`);
    if (!obj) fail(404, 'הגיבוי לא נמצא');
    return new Response(obj.body, { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="ambassador-backup-${r[1]}"` } });
  }
  if (p === '/api/backup/import' && m === 'POST') {
    const { snapshot } = await body(request);
    const written = await restoreSnapshot(env, snapshot);
    await logActivity(env, 'backup', `שוחזר גיבוי, נוספו ${written} רשומות חסרות`);
    return json({ ok: true, written });
  }

  if ((r = p.match(/^\/api\/media\/(.+)$/))) return media(env, decodeURIComponent(r[1]), request);

  fail(404, 'לא נמצא');
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const p = url.pathname;
  const m = request.method;

  // A site served on its own domain should not also answer on the infrastructure address.
  if (env.CANONICAL_HOST && url.hostname !== env.CANONICAL_HOST && url.hostname.endsWith('.workers.dev')) {
    return Response.redirect(`https://${env.CANONICAL_HOST}${p}${url.search}`, 301);
  }

  if (!p.startsWith('/api/')) {
    // Every page is the same app shell; the browser decides what to draw.
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  }

  // Cross-site writes are refused outright: the session cookie is SameSite=Lax, and this
  // closes the remaining gap for anything that is not a plain GET.
  if (m !== 'GET' && m !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return bad('בקשה ממקור לא מורשה', 403);
  }

  if (p === '/api/auth/login' && m === 'POST') return login(request, env);
  if (p === '/api/auth/logout' && m === 'POST') return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0) });
  if (p === '/api/public/config') return publicConfig(env);
  if (p === '/api/public/candidates' && m === 'POST') return submitCandidate(request, env, ctx);
  let r;
  if ((r = p.match(/^\/api\/public\/review\/([a-f0-9]{32})$/))) {
    if (m === 'GET') return getReview(env, r[1]);
    if (m === 'POST') return approveReview(request, env, ctx, r[1]);
  }
  if ((r = p.match(/^\/api\/public\/review\/([a-f0-9]{32})\/published$/)) && m === 'POST') return reviewPublished(request, env, ctx, r[1]);

  if (!(await isAuthed(request, env))) return bad('נדרשת התחברות', 401);
  return admin(request, env, ctx, url);
}

function harden(res) {
  const h = new Headers(res.headers);
  h.set('x-robots-tag', 'noindex, nofollow, noarchive');
  h.set('x-content-type-options', 'nosniff');
  h.set('x-frame-options', 'DENY');
  // The review link carries the ambassador's token; it must never leak to LinkedIn or Facebook
  // through the Referer header when they click out to publish.
  h.set('referrer-policy', 'no-referrer');
  if (!h.has('cache-control') && res.headers.get('content-type')?.includes('json')) h.set('cache-control', 'no-store');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(request, env, ctx) {
    try {
      return harden(await route(request, env, ctx));
    } catch (e) {
      if (e instanceof HttpError) return harden(bad(e.message, e.status));
      console.error(e);
      return harden(bad(e?.message && /[֐-׿]/.test(e.message) ? e.message : 'משהו השתבש בשרת. אפשר לנסות שוב', 500));
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      // Not logged to the activity feed: a daily line would bury the events that matter.
      // The backup screen lists every stored copy.
      await backupToR2(env);
      await env.DB.prepare('DELETE FROM throttle WHERE window_start < ? AND locked_until < ?').bind(Date.now() - DAY, Date.now()).run();
    })());
  },
};
