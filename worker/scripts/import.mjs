// One-time move from the Railway file layout into D1 + R2.
//
//   node scripts/import.mjs <backup.json> [--remote] [--dry]
//
// Sources, in order (a later source with the same persona + file name replaces an earlier one,
// exactly as the old app's merged reads behaved):
//   1. the curated content in git: ../personas/<slug>/ and ../outputs/<slug>/
//   2. the Railway volume backup: candidates/, personas/, outputs/
// Prints counts only. Candidate answers never reach the console.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { QUESTIONNAIRE_SECTIONS } from '../public/questionnaire.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const outDir = path.join(here, 'out');
const [backupPath, ...flags] = process.argv.slice(2);
const remote = flags.includes('--remote');
const dry = flags.includes('--dry');
if (!backupPath) { console.error('usage: node scripts/import.mjs <backup.json> [--remote] [--dry]'); process.exit(1); }

const ORIGINAL_MARKER = '\n\n<!-- גרסה מקורית לפני עריכת השגריר/ה -->\n\n';
const VALID_Q = new Set(QUESTIONNAIRE_SECTIONS.flatMap((s) => s.questions.map((q) => q.id)));
const now = new Date().toISOString();
const in14 = new Date(Date.now() + 14 * 86400000).toISOString();
const noEmDash = (s) => String(s ?? '').replace(/\s*—\s*/g, ' - ');

function frontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const data = {};
  if (m) for (const line of m[1].split(/\r?\n/)) { const kv = line.match(/^([\w-]+):\s*(.*)$/); if (kv) data[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"'); }
  return { data, content: m ? md.slice(m[0].length) : md };
}
function parsePost(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const meta = {}; let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (m) meta[m[1].trim()] = m[2].trim();
    else if (lines[i].startsWith('---')) { start = i + 1; break; }
  }
  const body = lines.slice(start).join('\n').trim();
  const [content, original] = body.split(ORIGINAL_MARKER);
  return { meta, content: content.trim(), original: original?.trim() || null };
}
function parseAnswers(content) {
  const answers = {};
  const re = /^### (q\d+)\n\n\*\*שאלה:\*\*[^\n]*\n\n\*\*תשובה:\*\*\n\n([\s\S]*?)(?=\n### q\d+|\n---\n|\n*$)/gm;
  let m;
  while ((m = re.exec(content.replace(/\r\n/g, '\n')))) { const t = m[2].trim(); if (VALID_Q.has(m[1])) answers[m[1]] = t === '_(לא נענה)_' ? '' : t; }
  return answers;
}

// ---------- gather ----------
const personas = new Map();   // slug -> row
const samples = new Map();    // slug/filename -> row
const posts = new Map();      // slug/filename -> row
const candidates = new Map(); // slug -> row
const media = [];             // { key, file, type }
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };

function addPersona(slug, md, origin, files) {
  const { data } = frontmatter(md);
  const row = personas.get(slug) || { slug, image_key: null, video_key: null, created_at: data['last-updated'] ? `${data['last-updated']}T00:00:00.000Z` : now };
  Object.assign(row, { name: data.name || slug, english_name: '', role: data.role || '', company: data.company || '', profile_md: noEmDash(md.replace(/\r\n/g, '\n').trim()), training_status: data['training-status'] || 'draft', origin, updated_at: now });
  for (const f of files) {
    const ext = path.extname(f.name).toLowerCase();
    if (!MIME[ext]) continue;
    const key = `personas/${slug}/${f.name}`;
    media.push({ key, file: f.file, type: MIME[ext] });
    if (MIME[ext].startsWith('image/')) row.image_key = key; else row.video_key = key;
  }
  personas.set(slug, row);
}
function addPost(slug, filename, raw, source) {
  const { meta, content, original } = parsePost(raw);
  const status = ['draft', 'pending', 'approved'].includes(meta.status) ? meta.status : 'draft';
  const date = (filename.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1];
  const token = /^[a-f0-9]{32}$/.test(meta.token || '') ? meta.token : null;
  posts.set(`${slug}/${filename}`, {
    persona_slug: slug, filename, topic: meta['נושא'] || meta.Topic || '', platform: meta['פלטפורמה'] || meta.Platform || '', goal: meta['מטרה'] || meta.Goal || '',
    body: noEmDash(content), original_body: original ? noEmDash(original) : null, edited: meta['נערך'] === 'true' ? 1 : 0, status, token,
    token_expires_at: status === 'pending' && token ? in14 : null, sent_at: meta['נשלח לאישור'] || null, approved_at: meta['אושר'] || null,
    created_at: date ? `${date}T00:00:00.000Z` : now, updated_at: now, source,
  });
}

// 1. git
for (const slug of fs.readdirSync(path.join(repo, 'personas'))) {
  const dir = path.join(repo, 'personas', slug);
  if (!fs.existsSync(path.join(dir, 'profile.md'))) continue;
  const files = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()).map((name) => ({ name, file: path.join(dir, name) }));
  addPersona(slug, fs.readFileSync(path.join(dir, 'profile.md'), 'utf8'), 'curated', files);
  const sd = path.join(dir, 'samples');
  if (fs.existsSync(sd)) for (const f of fs.readdirSync(sd).filter((x) => x.endsWith('.md')).sort()) samples.set(`${slug}/${f}`, { persona_slug: slug, filename: f, content: noEmDash(fs.readFileSync(path.join(sd, f), 'utf8').replace(/\r\n/g, '\n').trim()) });
}
for (const slug of fs.readdirSync(path.join(repo, 'outputs'))) {
  const dir = path.join(repo, 'outputs', slug);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) addPost(slug, f, fs.readFileSync(path.join(dir, f), 'utf8'), 'git');
}
const gitCounts = { personas: personas.size, samples: samples.size, posts: posts.size };

// 2. backup
const snap = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
if (!Array.isArray(snap.files)) throw new Error('backup has no files array');
const backupCounts = { files: snap.files.length, candidates: 0, personas: 0, posts: 0, postsReplacingGit: 0 };
fs.mkdirSync(path.join(outDir, 'media'), { recursive: true });
const byDir = {};
for (const f of snap.files) { const parts = f.path.split('/'); (byDir[parts.slice(0, 2).join('/')] ||= []).push({ ...f, parts }); }
const bin = (f) => Buffer.from(f.content, f.encoding === 'base64' ? 'base64' : 'utf8');
for (const [dirKey, files] of Object.entries(byDir)) {
  const [top, slug] = dirKey.split('/');
  if (top === 'personas') {
    const prof = files.find((f) => f.parts[2] === 'profile.md');
    if (!prof) continue;
    const mediaFiles = files.filter((f) => f.parts.length === 3 && MIME[path.extname(f.parts[2]).toLowerCase()]).map((f) => {
      const file = path.join(outDir, 'media', `${slug}-${f.parts[2]}`); fs.writeFileSync(file, bin(f)); return { name: f.parts[2], file };
    });
    addPersona(slug, bin(prof).toString('utf8'), 'app', mediaFiles);
    for (const s of files.filter((f) => f.parts[2] === 'samples' && f.parts[3]?.endsWith('.md'))) samples.set(`${slug}/${s.parts[3]}`, { persona_slug: slug, filename: s.parts[3], content: noEmDash(bin(s).toString('utf8').trim()) });
    backupCounts.personas++;
  } else if (top === 'outputs') {
    for (const f of files.filter((x) => x.parts.length === 3 && x.parts[2].endsWith('.md'))) {
      if (posts.has(`${slug}/${f.parts[2]}`)) backupCounts.postsReplacingGit++;
      addPost(slug, f.parts[2], bin(f).toString('utf8'), 'backup');
      backupCounts.posts++;
    }
  } else if (top === 'candidates') {
    const a = files.find((f) => f.parts[2] === 'answers.md');
    if (!a) continue;
    const { data, content } = frontmatter(bin(a).toString('utf8'));
    const answers = parseAnswers(content);
    candidates.set(slug, {
      slug, name: data.name || slug, english_name: data['english-name'] || '', role: data.role || '', company: data.company || '', email: data.email || '',
      answers_json: JSON.stringify(answers), answered_count: Object.values(answers).filter((x) => x.trim()).length,
      status: ['new', 'reviewed', 'persona-created', 'rejected'].includes(data.status) ? data.status : 'new', submitted_at: data['submitted-at'] || now,
    });
    backupCounts.candidates++;
  }
}

// ---------- SQL ----------
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const ins = (table, row, cols) => `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => q(row[c])).join(',')});`;
const sql = [];
for (const r of personas.values()) sql.push(ins('personas', r, ['slug', 'name', 'english_name', 'role', 'company', 'profile_md', 'training_status', 'origin', 'image_key', 'video_key', 'created_at', 'updated_at']));
for (const r of samples.values()) sql.push(ins('samples', r, ['persona_slug', 'filename', 'content']));
for (const r of candidates.values()) sql.push(ins('candidates', r, ['slug', 'name', 'english_name', 'role', 'company', 'email', 'answers_json', 'answered_count', 'status', 'submitted_at']));
for (const r of posts.values()) sql.push(ins('posts', r, ['persona_slug', 'filename', 'topic', 'platform', 'goal', 'body', 'original_body', 'edited', 'status', 'token', 'token_expires_at', 'sent_at', 'approved_at', 'created_at', 'updated_at']));
sql.push(`INSERT INTO activity (at, kind, message) VALUES (${q(now)}, 'backup', ${q(`הנתונים הועברו מהשרת הקודם: ${personas.size} שגרירים, ${candidates.size} מועמדים, ${posts.size} פוסטים`)});`);
fs.writeFileSync(path.join(outDir, 'import.sql'), sql.join('\n') + '\n', 'utf8');

console.log(JSON.stringify({ git: gitCounts, backup: backupCounts, toImport: { personas: personas.size, samples: samples.size, candidates: candidates.size, posts: posts.size, media: media.length } }, null, 1));
if (dry) process.exit(0);

// ---------- run ----------
const where = remote ? '--remote' : '--local';
const wr = (args) => execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', ...args], { cwd: path.resolve(here, '..'), stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }).toString();
wr(['d1', 'execute', 'ambassador', where, '--yes', '--file', path.join(outDir, 'import.sql')]);
for (const m of media) wr(['r2', 'object', 'put', `ambassador-media/${m.key}`, '--file', m.file, '--content-type', m.type, where]);
console.log('imported', where);
