// Admin screens. Everything here speaks the owner's language: "שגרירים", "פוסטים", "אישור".
import { $, $$, esc, icon, api, on, go, toast, modal, confirmDanger, copyText, busy, fmtDate, fmtWhen, localDay, initials, setCounts, MONTHS } from '/core.js';
import { QUESTIONNAIRE_SECTIONS as SECTIONS } from '/questionnaire.js';

const PLATFORMS = ['לינקדאין', 'פייסבוק', 'אינסטגרם', 'X'];
const TONES = ['', 'יותר אישי', 'עם נתונים', 'קצר וממוקד', 'השראתי'];
const KIND = { holiday: 'חג או מועד', event: 'אירוע', campaign: 'קמפיין של כללית', other: 'אחר' };
const CAND_STATUS = { new: ['חדש/ה', 'info'], reviewed: ['נקרא', 'plain'], 'persona-created': ['נבנתה פרסונה', 'ok'], rejected: ['לא מתאים/ה', 'bad'] };
const LANG_NAMES = { he: 'עברית', ar: 'ערבית', ru: 'רוסית', en: 'אנגלית' };
const FLAG_NAMES = { patient: 'עלול לזהות מטופל', medical_claim: 'טענה רפואית', sensitive: 'נושא רגיש', boundary: 'נגד מה שביקש/ה', fabrication: 'פרט בלי מקור' };

// WhatsApp opens on the owner's own phone or computer with the message ready; nothing is sent
// until they press send there.
export const waUrl = (phone, text) => `https://wa.me/${phone || ''}?text=${encodeURIComponent(text)}`;
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const reviewMsg = (name, url) => `היי ${firstName(name)}, כתבנו פוסט בשמך ונשמח שתעבור/י עליו. אפשר לאשר כמו שהוא, לערוך או לא לאשר. שום דבר לא עולה בלי האישור שלך:\n${url}`;
const reminderMsg = (name, url) => `היי ${firstName(name)}, רק מזכיר/ה: הפוסט שכתבנו בשמך עדיין מחכה לך. לוקח דקה:\n${url}`;
const storyMsg = (name, url) => `היי ${firstName(name)}, אם יש לך סיפור מהעבודה (רגע מהמשמרת, משהו שלמדת), אפשר לשלוח אותו כאן בכמה שורות או בקול, ואנחנו נכין ממנו טיוטת פוסט לאישור שלך:\n${url}`;

export function flagsHtml(flags) {
  if (!flags) return '';
  if (!flags.length) return `<div class="note ok">${icon('shield-check')}<div>בדיקת הבטיחות לא מצאה בעיות.</div></div>`;
  return `<div class="flags">${flags.map((f) => `<div class="f">${icon('circle-alert')}<div><b>${esc(FLAG_NAMES[f.kind] || 'לבדיקה')}:</b> <q>${esc(f.quote)}</q><div class="small">${esc(f.why)}</div></div></div>`).join('')}</div>`;
}

// The operator sees the flags before the ambassador sees the post. Nothing is edited or blocked by itself.
async function checkBeforeSend(x, { force = false } = {}) {
  let flags = x.safety;
  if (force || !flags || x.safetyStale) {
    toast('בודק את הפוסט לפני שליחה...', 'shield-check');
    flags = (await api(`/posts/${x.id}/check`, { method: 'POST' })).flags;
  }
  if (!flags.length) return true;
  return modal({ title: 'לפני ששולחים: כדאי לבדוק', body: `<p class="small muted" style="margin-bottom:12px">בדיקת הבטיחות מצאה ${flags.length} דברים לבדיקה. היא לא משנה את הטקסט. אפשר לערוך קודם, או לשלוח בכל זאת.</p>${flagsHtml(flags)}`, actions: [{ label: 'חזרה לעריכה', cls: 'ghost', value: false }, { label: 'שליחה בכל זאת', value: true }] });
}

function conflictWarn(conflicts) {
  if (!conflicts?.length) return;
  modal({ title: 'שימו לב: אותו נושא באותו יום', narrow: true, body: `<p>באותו תאריך מתוכנן גם פוסט על אותו נושא של ${conflicts.map((c) => esc(c.personaName)).join(', ')}. כשכמה שגרירים מפרסמים אותו דבר באותו יום, זה נראה כמו קמפיין ולא כמו אנשים. כדאי להזיז אחד מהם ביום או יומיים.</p>`, actions: [{ label: 'הבנתי', value: true }] });
}

async function afterSend(x, reviewUrl, phone) {
  await modal({ title: 'נשלח לאישור. עכשיו לשלוח לשגריר/ה', body: `<p class="small muted">הקישור הועתק. אפשר לשלוח אותו בוואטסאפ בלחיצה (ייפתח אצלך עם הודעה מוכנה, ואת/ה לוחץ/ת שליחה), או להעתיק את ההודעה.</p>
    <div class="linkbox" style="margin-top:14px"><code>${esc(reviewUrl)}</code></div>
    <label class="field"><span>ההודעה</span><textarea class="textarea" id="wamsg" rows="5">${esc(reviewMsg(x.personaName, reviewUrl))}</textarea></label>
    ${phone ? '' : '<p class="xs muted" style="margin-top:8px">אין מספר טלפון לשגריר/ה. וואטסאפ ייפתח ותבחר/י איש קשר. אפשר להוסיף מספר בלשונית "פרטים ותמונה".</p>'}
    <div class="btns" style="margin-top:16px"><a class="btn go" id="wago" href="${esc(waUrl(phone, reviewMsg(x.personaName, reviewUrl)))}" target="_blank" rel="noopener noreferrer">${icon('send')}<span>שליחה בוואטסאפ</span></a><button type="button" class="btn ghost" id="wacp">${icon('copy')}<span>העתקת ההודעה</span></button></div>`,
  actions: [] });
}
document.addEventListener('input', (e) => { if (e.target.id === 'wamsg') { const a = document.getElementById('wago'); if (a) a.href = a.href.replace(/text=.*$/, `text=${encodeURIComponent(e.target.value)}`); } });
document.addEventListener('click', async (e) => { if (e.target.closest('#wacp')) { if (await copyText(document.getElementById('wamsg').value)) toast('ההודעה הועתקה'); } });

function head(title, sub, actions = '', crumb = '') {
  document.title = `${title} · שגרירי כללית`;
  return `${crumb}<div class="head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}
const crumb = (href, label) => `<a class="crumb" href="${href}">${icon('chevron-right', 'sm')}${esc(label)}</a>`;

function statusChip(p) {
  if (p.publishedAt || p.publishedUrl) return '<span class="chip published">פורסם</span>';
  if (p.status === 'approved') return '<span class="chip ok">אושר</span>';
  if (p.status === 'pending') return p.linkExpired ? '<span class="chip bad">הקישור פג</span>' : '<span class="chip warn">ממתין לאישור</span>';
  return '<span class="chip plain">טיוטה</span>';
}
const photo = (p, cls = 'avatar') => `<div class="${cls}">${p.image ? `<img src="${esc(p.image)}" alt="">` : initials(p.name)}</div>`;

// ---------- dashboard ----------
on('/', async (page) => {
  const d = await api('/dashboard');
  setCounts({ newCandidates: d.newCandidates });
  const sum = (k) => d.personas.reduce((n, p) => n + (p.posts[k] || 0), 0);
  page.innerHTML = head('לוח בקרה', 'מה מחכה לטיפול, מה עולה בקרוב, ואיך כל שגריר/ה מתקדם/ת.', `<a class="btn" href="/generate">${icon('sparkles')}<span>יצירת פוסט</span></a>`) + `
    <div class="kpis">
      <div class="kpi"><div class="v">${d.personas.length}</div><div class="l">שגרירים</div><div class="s">עם פרופיל כתיבה</div></div>
      <div class="kpi" style="--c:var(--warn)"><div class="v">${d.pending.length}</div><div class="l">ממתינים לאישור</div><div class="s">נשלחו לשגרירים</div></div>
      <div class="kpi" style="--c:var(--green)"><div class="v">${sum('approved')}</div><div class="l">פוסטים שאושרו</div><div class="s">${sum('published')} מהם סומנו כפורסמו</div></div>
      <div class="kpi" style="--c:var(--sky)"><div class="v">${d.newCandidates}</div><div class="l">מועמדים חדשים</div><div class="s">מילאו שאלון ועוד לא נקראו</div></div>
    </div>
    <div class="grid g21">
      <div class="grid" style="align-content:start">
        ${d.overdue.length ? `<section class="card"><header><h2>צריך תזכורת</h2><p>פוסטים שמחכים לאישור יותר מ-3 ימים. התזכורת נפתחת אצלך בוואטסאפ, מוכנה לשליחה.</p></header>
          <div class="body flush rows">${d.overdue.map((p) => `<div><div class="grow"><div class="t">${esc(p.topic || 'בלי נושא')}</div><div class="d">${esc(p.personaName || '')} · נשלח ${fmtWhen(p.sentAt)}</div></div><span class="end"><a class="btn sm go" data-remind="${p.id}" href="${esc(waUrl(p.personaPhone, reminderMsg(p.personaName, `${location.origin}${p.reviewUrl}`)))}" target="_blank" rel="noopener noreferrer">${icon('send', 'sm')}<span>תזכורת בוואטסאפ</span></a></span></div>`).join('')}</div></section>` : ''}
        ${d.stories.length ? `<section class="card"><header><h2>סיפורים חדשים מהשגרירים</h2><p>מכל סיפור אפשר ליצור פוסט בלחיצה.</p></header>
          <div class="body flush rows">${d.stories.map((st) => `<div><div class="grow"><div class="t">${esc(st.persona_name)}</div><div class="d">${esc(st.text.slice(0, 140))}${st.text.length > 140 ? '...' : ''}</div></div><span class="end"><a class="btn sm" href="/generate?personas=${st.persona_slug}&story=${st.id}">${icon('sparkles', 'sm')}<span>פוסט מהסיפור</span></a></span></div>`).join('')}</div></section>` : ''}
        <section class="card"><header><h2>מחכים לאישור של השגרירים</h2><p>פוסטים שנשלחו ועוד לא אושרו. קישור שפג אפשר לשלוח מחדש מעמוד השגריר/ה.</p></header>
          <div class="body flush rows">${d.pending.length ? d.pending.map((p) => `<a href="/personas/${p.personaSlug}"><div class="grow"><div class="t">${esc(p.topic || 'בלי נושא')}</div><div class="d">${esc(p.personaName || '')} · נשלח ${fmtWhen(p.sentAt)}</div></div><span class="end">${statusChip(p)}</span></a>`).join('') : '<div class="empty">אין כרגע פוסטים שמחכים לאישור.</div>'}</div></section>
        <section class="card"><header><h2>עולים בשבועיים הקרובים</h2><a class="more link" href="/calendar">ללוח הפרסומים</a></header>
          <div class="body flush rows">${d.upcoming.length ? d.upcoming.map((p) => `<a href="/personas/${p.personaSlug}"><div class="grow"><div class="t">${esc(p.topic || 'בלי נושא')}</div><div class="d">${esc(p.personaName || '')} · ${fmtDate(p.scheduledFor)}</div></div><span class="end">${statusChip(p)}</span></a>`).join('') : '<div class="empty">לא תוזמנו פוסטים לשבועיים הקרובים.</div>'}</div></section>
      </div>
      <div class="grid" style="align-content:start">
        <section class="card"><header><h2>נושאים קרובים</h2><a class="more link" href="/topics">ללוח הנושאים</a></header>
          <div class="body flush rows">${d.topics.length ? d.topics.map((t) => `<a href="/generate?topic=${t.id}"><div class="grow"><div class="t">${esc(t.title)}</div><div class="d">${fmtDate(t.date)} · ${KIND[t.kind] || ''}</div></div><span class="end">${icon('sparkles', 'sm')}</span></a>`).join('') : '<div class="empty">אין נושאים בחודש וחצי הקרובים. <a class="link" href="/topics">להוספת נושא</a></div>'}</div></section>
        <section class="card"><header><h2>מה קרה לאחרונה</h2><a class="more link" href="/activity">הכל</a></header>
          <div class="body flush rows">${d.activity.length ? d.activity.map((a) => `<${a.link ? `a href="${esc(a.link)}"` : 'div'}><div class="grow"><div class="small">${esc(a.message)}</div><div class="d">${fmtWhen(a.at)}</div></div></${a.link ? 'a' : 'div'}>`).join('') : '<div class="empty">עוד אין פעילות.</div>'}</div></section>
      </div>
    </div>
    <h2 style="font-size:22px;color:var(--deep);margin:36px 0 16px">השגרירים</h2>
    <div class="people">${d.personas.map(personCard).join('')}</div>`;
  $$('[data-remind]', page).forEach((a) => { a.addEventListener('click', () => { api(`/posts/${a.dataset.remind}/reminded`, { method: 'POST' }).catch(() => {}); }); });
});

function personCard(p) {
  const s = p.posts || {};
  return `<article class="person">${photo(p, 'ph')}
    <div class="in"><h3>${esc(p.name)}</h3><div class="role">${esc([p.role, p.company].filter(Boolean).join(' · '))}</div>
      ${p.personalityWords ? `<div class="words">${esc(p.personalityWords)}</div>` : ''}
      ${p.posts ? `<div class="stats"><span class="chip plain">${s.draft || 0} טיוטות</span><span class="chip warn">${s.pending || 0} ממתינים</span><span class="chip ok">${s.approved || 0} אושרו</span></div>` : ''}
      <div class="btns"><a class="btn sm" href="/personas/${p.slug}">לעמוד השגריר/ה</a><a class="btn sm ghost" href="/generate?personas=${p.slug}">פוסט חדש</a></div></div></article>`;
}

// ---------- personas ----------
on('/personas', async (page) => {
  const d = await api('/dashboard');
  page.innerHTML = head('שגרירים', 'לכל שגריר/ה יש פרופיל קול ודוגמאות כתיבה. מהם נכתבים הפוסטים. שגריר/ה חדש/ה נוסף/ה מתוך שאלון של מועמד/ת.', `<a class="btn ghost" href="/candidates">${icon('user-plus')}<span>מהשאלונים</span></a>`)
    + `<div class="people">${d.personas.map(personCard).join('')}</div>`;
});

on('/personas/([a-z0-9-]+)', async (page, slug) => {
  let tab = new URLSearchParams(location.search).get('tab') || 'posts';
  const p = await api(`/personas/${slug}`);
  const draw = () => {
    page.innerHTML = crumb('/personas', 'כל השגרירים') + `<div class="head"><div class="hero">${photo(p)}<div><h1>${esc(p.name)}</h1><p>${esc([p.role, p.company].filter(Boolean).join(' · '))}</p>${p.personalityWords ? `<p style="color:var(--teal);margin-top:4px">${esc(p.personalityWords)}</p>` : ''}</div></div>
      <div class="actions"><a class="btn" href="/generate?personas=${slug}">${icon('sparkles')}<span>פוסט חדש</span></a></div></div>
      <div class="tabs" role="tablist">${[['posts', `פוסטים (${p.posts.length})`], ['stories', 'סיפורים'], ['network', 'פרופיל ברשת'], ['profile', 'פרופיל הקול'], ['samples', `דוגמאות כתיבה (${p.samples.length})`], ['media', 'פרטים ותמונה']].map(([k, l]) => `<button type="button" role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="tab"></div>`;
    $$('[data-tab]', page).forEach((b) => { b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, '', `?tab=${tab}`); draw(); }; });
    ({ posts: postsTab, stories: storiesTab, network: networkTab, profile: profileTab, samples: samplesTab, media: mediaTab })[tab]($('#tab', page), p, reload);
  };
  const reload = async () => { Object.assign(p, await api(`/personas/${slug}`)); draw(); };
  document.title = `${p.name} · שגרירי כללית`;
  draw();
});

function postsTab(el, p, reload) {
  if (!p.posts.length) { el.innerHTML = `<div class="card"><div class="empty">עוד אין פוסטים. <a class="link" href="/generate?personas=${p.slug}">ליצירת הפוסט הראשון</a></div></div>`; return; }
  el.innerHTML = p.posts.map((x) => `<article class="post" data-id="${x.id}">
    <header><div class="t">${esc(x.topic || 'בלי נושא')}</div>${statusChip(x)}${x.platform ? `<span class="chip plain">${esc(x.platform)}</span>` : ''}${x.language !== 'he' ? `<span class="chip plain">${LANG_NAMES[x.language] || ''}</span>` : ''}${x.edited ? `<span class="chip info">נערך ע"י השגריר/ה${x.editRatio != null ? ` · שונה ${Math.round(x.editRatio * 100)}%` : ''}</span>` : ''}${x.status === 'approved' && !x.edited ? '<span class="chip ok">אושר בלי שינוי</span>' : ''}${x.voiceScore ? `<span class="chip plain">דומה לקול: ${x.voiceScore} מתוך 10</span>` : ''}${x.trackUrl ? `<span class="chip published">${x.clicks || 0} כניסות דרך הקישור</span>` : ''}${x.alternatives?.length && x.status !== 'approved' ? `<span class="chip plain">${x.alternatives.length + 1} גרסאות לבחירת השגריר/ה</span>` : ''}
      <span class="xs muted" style="margin-inline-start:auto">נוצר ${fmtDate(x.createdAt)}${x.scheduledFor ? ` · מתוזמן ל${fmtDate(x.scheduledFor)}` : ''}</span></header>
    <div class="text">${esc(x.body)}</div>
    ${x.originalBody ? `<details style="margin:0 20px 16px"><summary class="link" style="cursor:pointer">מה המערכת כתבה במקור</summary><div class="orig" style="margin:10px 0 0">${esc(x.originalBody)}</div></details>` : ''}
    ${x.confirm?.length && x.status !== 'approved' ? `<div style="margin:0 20px 16px" class="warnbox"><b>פרטים שהשגריר/ה יתבקש/תתבקש לאשר</b> (לא הגיעו מהחומר שלו/ה):<ul class="confirm">${x.confirm.map((c) => `<li>"${esc(c)}"</li>`).join('')}</ul></div>` : ''}
    ${x.safety && x.status !== 'approved' ? `<div style="margin:0 20px 16px">${x.safetyStale ? '<p class="xs muted" style="margin-bottom:6px">הטקסט השתנה מאז הבדיקה האחרונה.</p>' : ''}${flagsHtml(x.safety)}</div>` : ''}
    ${x.reactions != null || x.comments != null || x.impressions != null || x.feedbackNote ? `<p class="small" style="margin:0 20px 16px">${icon('star', 'sm')} ${x.impressions != null ? `${x.impressions} צפיות · ` : ''}${x.reactions ?? 0} לייקים · ${x.comments ?? 0} תגובות${x.feedbackNote ? ` · ${esc(x.feedbackNote)}` : ''}</p>` : ''}
    <footer>
      <div class="btns">
        <button type="button" class="btn sm ghost" data-copy>${icon('copy', 'sm')}<span>העתקה</span></button>
        ${x.status === 'draft' ? `<button type="button" class="btn sm" data-send>${icon('send', 'sm')}<span>שליחה לאישור</span></button><button type="button" class="btn sm ghost" data-edit>${icon('pencil', 'sm')}<span>עריכה</span></button>` : ''}
        ${x.status === 'pending' ? `<button type="button" class="btn sm ${x.linkExpired ? '' : 'ghost'}" data-send>${icon('refresh-cw', 'sm')}<span>${x.linkExpired ? 'חידוש הקישור' : 'שליחה מחדש'}</span></button><button type="button" class="btn sm ghost" data-edit>${icon('pencil', 'sm')}<span>עריכה</span></button>` : ''}
        ${x.status !== 'approved' ? `<button type="button" class="btn sm ghost" data-check>${icon('shield-check', 'sm')}<span>בדיקת בטיחות</span></button>` : ''}
        ${x.status === 'approved' ? `<button type="button" class="btn sm ghost" data-pub>${icon('link', 'sm')}<span>${x.publishedUrl ? 'הקישור לפוסט' : 'סימון כפורסם'}</span></button><button type="button" class="btn sm ghost" data-feedback>${icon('star', 'sm')}<span>איך הפוסט הלך</span></button>${x.originalBody ? `<button type="button" class="btn sm ghost" data-lesson>${icon('wand-sparkles', 'sm')}<span>מה למדנו מהעריכה</span></button>` : ''}<button type="button" class="btn sm ghost" data-reopen>${icon('rotate-ccw', 'sm')}<span>שליחה לאישור מחדש</span></button>` : ''}
        <button type="button" class="btn sm ghost" data-track>${icon('link', 'sm')}<span>${x.trackUrl ? 'קישור המעקב' : 'קישור מעקב'}</span></button>
        <button type="button" class="btn sm ghost" data-image>${icon('image', 'sm')}<span>${x.imageId ? 'החלפת התמונה' : 'תמונה'}</span></button>
        <button type="button" class="btn sm ghost" data-date>${icon('calendar', 'sm')}<span>${x.scheduledFor ? 'שינוי תאריך' : 'תזמון'}</span></button>
        <button type="button" class="btn sm danger-ghost" data-del>${icon('trash-2', 'sm')}<span>מחיקה</span></button>
      </div>
      ${x.reviewUrl && x.status !== 'draft' ? `<div class="linkbox">${icon('link', 'sm')}<span class="nowrap">קישור לשגריר/ה:</span><code>${esc(x.reviewUrl)}</code><button type="button" class="btn sm ghost" data-copylink>העתקת הקישור</button>${x.status === 'pending' ? `<a class="btn sm go" href="${esc(waUrl(p.phone, reviewMsg(p.name, x.reviewUrl)))}" target="_blank" rel="noopener noreferrer">${icon('send', 'sm')}<span>וואטסאפ</span></a>` : ''}</div>${x.status === 'pending' ? `<p class="xs muted">${x.linkExpired ? 'תוקף הקישור פג. "חידוש הקישור" מאריך אותו ב-14 יום, באותה כתובת.' : `הקישור פעיל עד ${fmtDate(x.tokenExpiresAt)}.`}</p>` : ''}` : ''}
      ${x.trackUrl ? `<div class="linkbox">${icon('link', 'sm')}<span class="nowrap">קישור מעקב:</span><code>${esc(x.trackUrl)}</code><button type="button" class="btn sm ghost" data-copytrack>העתקה</button></div><p class="xs muted">כדאי שהשגריר/ה ידביק/תדביק אותו בתגובה הראשונה ולא בגוף הפוסט: הרשתות מראות פחות פוסטים עם קישור. הוא מופיע לו/ה בעמוד האישור.</p>` : ''}
      ${x.publishedUrl ? `<p class="small">פורסם: <a class="link" href="${esc(x.publishedUrl)}" target="_blank" rel="noopener noreferrer" dir="ltr">${esc(x.publishedUrl.replace(/^https?:\/\//, '').slice(0, 60))}</a></p>` : ''}
      <div data-lessonbox></div>
    </footer></article>`).join('');

  $$('.post', el).forEach((card) => {
    const x = p.posts.find((y) => y.id === Number(card.dataset.id));
    x.personaName = p.name;
    const q = (s) => $(s, card);
    q('[data-copy]').onclick = async () => { if (await copyText(x.body)) toast('הטקסט הועתק'); };
    q('[data-copylink]')?.addEventListener('click', async () => { if (await copyText(x.reviewUrl)) toast('הקישור הועתק. אפשר לשלוח אותו לשגריר/ה'); });
    q('[data-copytrack]')?.addEventListener('click', async () => { if (await copyText(x.trackUrl)) toast('קישור המעקב הועתק'); });
    const send = async (btn, skipCheck = false) => {
      try {
        if (!skipCheck && !(await checkBeforeSend(x))) { await reload(); return; }
        busy(btn, true, 'שולח...');
        const r = await api(`/posts/${x.id}/send`, { method: 'POST' });
        await copyText(r.reviewUrl);
        await reload();
        afterSend(x, r.reviewUrl, p.phone);
      } catch (e) { toast(e.message, 'circle-alert'); busy(btn, false); }
    };
    q('[data-send]')?.addEventListener('click', (e) => send(e.currentTarget));
    q('[data-check]')?.addEventListener('click', async (e) => {
      busy(e.currentTarget, true, 'בודק...');
      try { await api(`/posts/${x.id}/check`, { method: 'POST' }); await reload(); } catch (er) { toast(er.message, 'circle-alert'); busy(e.currentTarget, false); }
    });
    q('[data-reopen]')?.addEventListener('click', async (e) => {
      const ok = await modal({ title: 'לשלוח לאישור מחדש?', narrow: true, body: '<p>הפוסט יחזור למצב "ממתין לאישור", והשגריר/ה יוכל/תוכל לערוך ולאשר אותו שוב באותו קישור. כדאי לעשות את זה רק אם צריך לשנות את הנוסח שאושר.</p>', actions: [{ label: 'ביטול', cls: 'ghost', value: false }, { label: 'שליחה לאישור מחדש', value: true }] });
      if (ok) send(e.currentTarget, true);
    });
    q('[data-edit]')?.addEventListener('click', async () => {
      const text = await modal({ title: 'עריכת הפוסט', body: `<label class="field" style="margin-top:0"><span class="sr">טקסט</span><textarea class="textarea tall" id="ed">${esc(x.body)}</textarea></label>${x.status === 'pending' ? '<p class="xs muted" style="margin-top:8px">השגריר/ה יראה/תראה את הנוסח המעודכן באותו קישור.</p>' : ''}`, actions: [{ label: 'ביטול', cls: 'ghost', value: null }, { label: 'שמירה', collect: (m) => $('#ed', m).value }] });
      if (text == null) return;
      try { await api(`/posts/${x.id}`, { method: 'PATCH', body: { body: text } }); toast('נשמר'); await reload(); } catch (e) { toast(e.message, 'circle-alert'); }
    });
    q('[data-date]').onclick = async () => {
      const v = await modal({ title: 'תזמון הפוסט', narrow: true, body: `<p class="small muted">התאריך שבו הפוסט אמור לעלות. מופיע בלוח הפרסומים.</p><label class="field"><span>תאריך</span><input class="input" type="date" id="dt" value="${esc(x.scheduledFor || '')}"></label>`, actions: [{ label: 'הסרת התאריך', cls: 'ghost', value: '' }, { label: 'שמירה', collect: (m) => $('#dt', m).value }] });
      if (v == null) return;
      try { const r = await api(`/posts/${x.id}`, { method: 'PATCH', body: { scheduledFor: v || null } }); toast(v ? 'התאריך נשמר' : 'התאריך הוסר'); await reload(); conflictWarn(r.conflicts); } catch (e) { toast(e.message, 'circle-alert'); }
    };
    q('[data-pub]')?.addEventListener('click', async () => {
      const v = await modal({ title: 'סימון כפורסם', narrow: true, body: `<p class="small muted">הקישור לפוסט ברשת, כדי לדעת מה באמת עלה. גם השגריר/ה יכול/ה להדביק אותו בעמוד האישור.</p><label class="field"><span>קישור לפוסט</span><input class="input" id="pu" dir="ltr" value="${esc(x.publishedUrl || '')}" placeholder="https://"></label>`, actions: [{ label: x.publishedAt ? 'ביטול הסימון' : 'פורסם, בלי קישור', cls: 'ghost', value: x.publishedAt ? { off: true } : { url: '' } }, { label: 'שמירה', collect: (m) => ({ url: $('#pu', m).value.trim() }) }] });
      if (!v) return;
      try { await api(`/posts/${x.id}`, { method: 'PATCH', body: v.off ? { publishedUrl: null, published: false } : { publishedUrl: v.url || null, published: true } }); toast('נשמר'); await reload(); } catch (e) { toast(e.message, 'circle-alert'); }
    });
    q('[data-feedback]')?.addEventListener('click', async () => {
      const v = await modal({ title: 'איך הפוסט הלך', narrow: true, body: `<p class="small muted">מספרים מהרשת, לפי מה שרואים בפוסט. השגריר/ה רואה אותם גם בעמוד האישור, ויכול/ה לעדכן בעצמו/ה.</p>
        <div class="grid g2" style="gap:0 16px"><label class="field"><span>לייקים ותגובות רגש</span><input class="input" type="number" min="0" id="rx" value="${x.reactions ?? ''}"></label><label class="field"><span>תגובות כתובות</span><input class="input" type="number" min="0" id="cm" value="${x.comments ?? ''}"></label></div>
        <label class="field"><span>צפיות</span><input class="input" type="number" min="0" id="im" value="${x.impressions ?? ''}"><span class="hint">בלינקדאין רואים את המספר מתחת לפוסט. משמש לאומדן השווי בדוח החודשי.</span></label>
        <label class="field"><span>הערה (לא חובה)</span><input class="input" id="fn" value="${esc(x.feedbackNote || '')}" placeholder="למשל: שלוש פניות על משרות"></label>`, actions: [{ label: 'ביטול', cls: 'ghost', value: null }, { label: 'שמירה', collect: (m) => ({ reactions: $('#rx', m).value, comments: $('#cm', m).value, impressions: $('#im', m).value, feedbackNote: $('#fn', m).value }) }] });
      if (!v) return;
      try { await api(`/posts/${x.id}`, { method: 'PATCH', body: v }); toast('נשמר'); await reload(); } catch (e) { toast(e.message, 'circle-alert'); }
    });
    q('[data-track]').onclick = async () => {
      const settings = await api('/settings').catch(() => ({}));
      const v = await modal({ title: 'קישור מעקב לפוסט', narrow: true, body: `<p class="small muted">קישור קצר שסופר כמה אנשים נכנסו דרך הפוסט של ${esc(p.name)}. הוא מוביל לכתובת שתבחר/י, למשל עמוד המשרות של כללית.</p><label class="field"><span>לאן הקישור מוביל</span><input class="input" id="tg" dir="ltr" placeholder="https://" value="${esc(settings.link_default_url || '')}"></label>`, actions: [{ label: 'ביטול', cls: 'ghost', value: null }, { label: x.trackUrl ? 'עדכון היעד' : 'יצירת הקישור', collect: (m) => $('#tg', m).value }] });
      if (!v) return;
      try { const r = await api(`/posts/${x.id}/link`, { body: { target: v } }); await copyText(r.url); toast('הקישור נוצר והועתק'); await reload(); } catch (e) { toast(e.message, 'circle-alert'); }
    };
    q('[data-image]').onclick = async () => {
      const assets = (await api('/assets')).filter((a) => a.consent);
      const picked = await modal({ title: 'תמונה לפוסט', body: assets.length ? `<p class="small muted" style="margin-bottom:14px">רק תמונות שסומנו "מאושרת לשימוש". השגריר/ה יוכל/תוכל להוריד אותה מעמוד האישור.</p><div class="assets">${assets.map((a) => `<button type="button" class="asset pickable" data-pick="${a.id}" style="padding:0;text-align:start;font:inherit;background:#fff"><img src="${esc(a.url)}" alt=""><div class="in"><b>${esc(a.title || 'בלי שם')}</b></div></button>`).join('')}</div>` : '<p>עוד אין תמונות מאושרות במאגר. <a class="link" href="/images">למאגר התמונות</a></p>', actions: x.imageId ? [{ label: 'הסרת התמונה מהפוסט', cls: 'danger-ghost', value: 0 }] : [] });
      if (picked === null || picked === undefined || picked === true) return;
      try { await api(`/posts/${x.id}`, { method: 'PATCH', body: { imageId: picked || null } }); toast(picked ? 'התמונה צורפה' : 'התמונה הוסרה'); await reload(); } catch (e) { toast(e.message, 'circle-alert'); }
    };
    q('[data-lesson]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget; busy(btn, true, 'מנתח את העריכה...');
      try {
        const { lesson } = await api(`/posts/${x.id}/lesson`, { method: 'POST' });
        q('[data-lessonbox]').innerHTML = `<div class="note">${icon('wand-sparkles')}<div style="flex:1;min-width:0"><b>טיוטת כללי כתיבה מהעריכה.</b> לא נכנסת לפרופיל לבד. אם היא נכונה, אפשר להוסיף אותה בלחיצה.<div class="pre small" style="margin-top:10px">${esc(lesson)}</div><div class="btns" style="margin-top:12px"><button type="button" class="btn sm" data-addlesson>הוספה לפרופיל</button><button type="button" class="btn sm ghost" data-copylesson>העתקה</button></div></div></div>`;
        q('[data-copylesson]').onclick = async () => { if (await copyText(lesson)) toast('הועתק'); };
        q('[data-addlesson]').onclick = async (ev) => {
          busy(ev.currentTarget, true, 'מוסיף...');
          try { await api(`/personas/${p.slug}`, { method: 'PATCH', body: { profileMarkdown: `${p.profileMarkdown.trim()}\n\n${lesson.replace('### לקח מעריכה', `### לקח מעריכה (${fmtDate(new Date().toISOString(), false)})`)}\n` } }); toast('נוסף לפרופיל הקול'); await reload(); }
          catch (err) { toast(err.message, 'circle-alert'); busy(ev.currentTarget, false); }
        };
      } catch (err) { toast(err.message, 'circle-alert'); }
      busy(btn, false);
    });
    q('[data-del]').onclick = async () => {
      if (!(await confirmDanger('למחוק את הפוסט?', x.status === 'approved' ? 'הפוסט כבר אושר. אחרי מחיקה הקישור של השגריר/ה יפסיק לעבוד. אי אפשר לבטל.' : 'הפוסט יימחק לגמרי, כולל הקישור לאישור. אי אפשר לבטל.', 'מחיקה'))) return;
      try { await api(`/posts/${x.id}`, { method: 'DELETE' }); toast('הפוסט נמחק'); await reload(); } catch (e) { toast(e.message, 'circle-alert'); }
    };
  });
}

function storiesTab(el, p, reload) {
  el.innerHTML = '<div class="loading"><span class="spin"></span> טוען...</div>';
  api(`/personas/${p.slug}/stories`).then((list) => {
    el.innerHTML = `<section class="card" style="margin-bottom:24px"><header><h2>הקישור האישי לסיפורים</h2><p>קישור קבוע ש${esc(p.name)} יכול/ה לשמור בטלפון. דרכו שולחים סיפור קצר מהעבודה, בכתב או בקול, בלי להתחבר. מכל סיפור אפשר ליצור פוסט.</p></header>
      <div class="body"><div class="btns">${p.storyPath ? `<button type="button" class="btn ghost" id="cps">${icon('copy')}<span>העתקת הקישור</span></button><a class="btn go" target="_blank" rel="noopener noreferrer" href="${esc(waUrl(p.phone, storyMsg(p.name, location.origin + p.storyPath)))}">${icon('send')}<span>שליחה בוואטסאפ</span></a>` : `<button type="button" class="btn" id="mk">${icon('link')}<span>יצירת קישור אישי</span></button>`}</div></div></section>
      ${list.length ? list.map((s) => `<article class="post"><header><div class="t" style="flex-basis:auto">${fmtWhen(s.created_at)}</div>${s.status === 'new' ? '<span class="chip info">חדש</span>' : s.status === 'used' ? '<span class="chip ok">נכתב ממנו פוסט</span>' : '<span class="chip plain">בארכיון</span>'}</header><div class="text">${esc(s.text)}</div>
        <footer><div class="btns"><a class="btn sm" href="/generate?personas=${p.slug}&story=${s.id}">${icon('sparkles', 'sm')}<span>פוסט מהסיפור</span></a>${s.status !== 'archived' ? `<button type="button" class="btn sm ghost" data-arch="${s.id}">העברה לארכיון</button>` : ''}<button type="button" class="btn sm danger-ghost" data-sdel="${s.id}">${icon('trash-2', 'sm')}<span>מחיקה</span></button></div></footer></article>`).join('') : '<div class="card"><div class="empty">עוד לא נשלחו סיפורים.</div></div>'}`;
    $('#mk', el)?.addEventListener('click', async () => { try { const r = await api(`/personas/${p.slug}/story-link`, { method: 'POST' }); await copyText(r.url); toast('הקישור נוצר והועתק'); await reload(); } catch (e) { toast(e.message, 'circle-alert'); } });
    $('#cps', el)?.addEventListener('click', async () => { if (await copyText(location.origin + p.storyPath)) toast('הקישור הועתק'); });
    $$('[data-arch]', el).forEach((b) => { b.onclick = async () => { await api(`/stories/${b.dataset.arch}`, { method: 'PATCH', body: { status: 'archived' } }); storiesTab(el, p, reload); }; });
    $$('[data-sdel]', el).forEach((b) => { b.onclick = async () => { if (!(await confirmDanger('למחוק את הסיפור?', 'הסיפור יימחק מהמערכת. אי אפשר לבטל.', 'מחיקה'))) return; await api(`/stories/${b.dataset.sdel}`, { method: 'DELETE' }); storiesTab(el, p, reload); }; });
  }).catch((e) => { el.innerHTML = `<div class="err">${esc(e.message)}</div>`; });
}

// The rules every ambassador gets once, before the first post. Plain words, healthcare-specific.
const GUIDELINES = `כמה כללים קצרים לשגרירי כללית ברשתות:
1. בלי שום פרט שמזהה מטופל: לא שם, לא גיל, לא תמונה, לא סיפור שאפשר לזהות. גם לא "בלי שמות" על מקרה נדיר.
2. בלי ייעוץ רפואי אישי ברשת. מי ששואל, מפנים לרופא/ה או למוקד של כללית, ${String.fromCharCode(0x200e)}*2700${String.fromCharCode(0x200e)}.
3. בלי צילום בתוך מחלקה או מרפאה כשרואים מטופלים, מסכים או מסמכים.
4. הדעות שלך הן שלך. בפוסט רפואי כדאי להוסיף: "הדעות כאן שלי, ואינן ייעוץ רפואי אישי".
5. תגובה שלילית או שאלה רגישה: לא להיגרר, אפשר להעביר אלינו.
6. שום פוסט לא עולה בשמך בלי שאישרת אותו.`;

function networkTab(el, p, reload) {
  const k = p.profileKit;
  el.innerHTML = `<div class="grid g2">
    <section class="card"><header><h2>הצעה לפרופיל בלינקדאין</h2><p>כותרת ותקציר בקול של ${esc(p.name)}, רק מעובדות שבפרופיל הקול. כך הפוסטים מגיעים לפרופיל שנראה אמין ומקצועי. שום דבר לא משתנה ברשת: זו הצעה שהשגריר/ה מעתיק/ה בעצמו/ה.</p></header>
      <div class="body">${k ? `<label class="field" style="margin-top:0"><span>כותרת (Headline)</span><textarea class="textarea" id="kh" rows="2" style="min-height:0">${esc(k.headline)}</textarea></label>
        <label class="field"><span>תקציר (About)</span><textarea class="textarea" id="ka" rows="8">${esc(k.about)}</textarea></label>
        ${k.tips?.length ? `<div class="note" style="margin-top:16px">${icon('info')}<div><b>טיפים לפרופיל</b><ul class="confirm">${k.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></div>` : ''}
        <div class="btns" style="margin-top:16px"><button type="button" class="btn" id="ks">${icon('save')}<span>שמירה</span></button><button type="button" class="btn ghost" id="kc">${icon('copy')}<span>העתקה</span></button><a class="btn go" id="kw" target="_blank" rel="noopener noreferrer">${icon('send')}<span>שליחה בוואטסאפ</span></a><button type="button" class="btn ghost" id="kg">${icon('refresh-cw')}<span>הצעה חדשה</span></button></div>`
        : `<button type="button" class="btn" id="kg">${icon('wand-sparkles')}<span>כתיבת הצעה לפרופיל</span></button>`}</div></section>
    <section class="card"><header><h2>כללים לשגריר/ה</h2><p>לשלוח פעם אחת, לפני הפוסט הראשון.</p></header>
      <div class="body"><textarea class="textarea" id="gl" rows="11" aria-label="כללים לשגריר/ה">${esc(GUIDELINES)}</textarea>
      <div class="btns" style="margin-top:16px"><a class="btn go" id="gw" target="_blank" rel="noopener noreferrer">${icon('send')}<span>שליחה בוואטסאפ</span></a><button type="button" class="btn ghost" id="gc">${icon('copy')}<span>העתקה</span></button></div></div></section>
  </div>`;
  const kitText = () => `היי ${firstName(p.name)}, הצעה לפרופיל שלך בלינקדאין, אפשר לשנות כל מה שתרצה/י:\n\nכותרת:\n${$('#kh', el).value}\n\nתקציר:\n${$('#ka', el).value}`;
  const sync = () => { if ($('#kw', el)) $('#kw', el).href = waUrl(p.phone, kitText()); $('#gw', el).href = waUrl(p.phone, $('#gl', el).value); };
  sync();
  el.addEventListener('input', sync);
  $('#gc', el).onclick = async () => { if (await copyText($('#gl', el).value)) toast('הועתק'); };
  $('#kc', el)?.addEventListener('click', async () => { if (await copyText(kitText())) toast('הועתק'); });
  $('#kg', el).onclick = async (e) => {
    busy(e.currentTarget, true, 'כותב הצעה...');
    try { await api(`/personas/${p.slug}/profile-kit`, { method: 'POST' }); await reload(); } catch (er) { toast(er.message, 'circle-alert'); busy(e.currentTarget, false); }
  };
  $('#ks', el)?.addEventListener('click', async (e) => {
    busy(e.currentTarget, true, 'שומר...');
    try { await api(`/personas/${p.slug}/profile-kit`, { method: 'PATCH', body: { headline: $('#kh', el).value, about: $('#ka', el).value, tips: k.tips } }); toast('נשמר'); } catch (er) { toast(er.message, 'circle-alert'); }
    busy(e.currentTarget, false);
  });
}

function profileTab(el, p, reload) {
  el.innerHTML = `<div class="card"><header><h2>פרופיל הקול</h2><p>מכאן המערכת יודעת איך ${esc(p.name)} כותב/ת. כל שינוי כאן משפיע על הפוסטים הבאים.</p></header>
    <div class="body"><textarea class="textarea tall code" id="pm" aria-label="פרופיל הקול">${esc(p.profileMarkdown)}</textarea>
    <div class="btns" style="margin-top:16px"><button type="button" class="btn" id="save">${icon('save')}<span>שמירה</span></button><span class="small muted" id="st"></span></div></div></div>`;
  const ta = $('#pm', el);
  ta.style.minHeight = '60vh';
  ta.oninput = () => { $('#st', el).textContent = 'יש שינויים שלא נשמרו'; };
  $('#save', el).onclick = async (e) => {
    busy(e.currentTarget, true, 'שומר...');
    try { await api(`/personas/${p.slug}`, { method: 'PATCH', body: { profileMarkdown: ta.value } }); toast('הפרופיל נשמר'); await reload(); }
    catch (err) { toast(err.message, 'circle-alert'); busy(e.currentTarget, false); }
  };
}

function samplesTab(el, p, reload) {
  el.innerHTML = `<div class="note" style="margin-bottom:20px">${icon('info')}<div>דוגמאות אמיתיות של כתיבה, הכי חשובות לאיכות הקול. כל דוגמה נשלחת למודל ה-AI בכל פוסט, ומשמשת גם לבדיקה כמה הפוסט נשמע כמו ${esc(p.name)}.</div></div>
    ${p.samples.map((s, i) => `<article class="post"><header><div class="t" style="flex-basis:auto">דוגמה ${i + 1}</div><button type="button" class="btn sm danger-ghost" style="margin-inline-start:auto" data-del="${s.id}">${icon('trash-2', 'sm')}<span>מחיקה</span></button></header><div class="text">${esc(s.content)}</div></article>`).join('')}
    <div class="card"><header><h2>הוספת דוגמה</h2></header><div class="body"><textarea class="textarea" id="ns" rows="6" aria-label="דוגמה חדשה" placeholder="פוסט, תגובה ארוכה או הודעה ש${esc(p.name)} כתב/ה בעצמו/ה"></textarea><div class="btns" style="margin-top:14px"><button type="button" class="btn" id="add">${icon('plus')}<span>הוספה</span></button></div></div></div>`;
  $('#add', el).onclick = async (e) => {
    busy(e.currentTarget, true, 'מוסיף...');
    try { await api(`/personas/${p.slug}/samples`, { body: { content: $('#ns', el).value } }); toast('הדוגמה נוספה'); await reload(); }
    catch (err) { toast(err.message, 'circle-alert'); busy(e.currentTarget, false); }
  };
  $$('[data-del]', el).forEach((b) => {
    b.onclick = async () => {
      if (!(await confirmDanger('למחוק את הדוגמה?', 'הדוגמה תימחק ולא תשמש יותר לכתיבה. אי אפשר לבטל.', 'מחיקה'))) return;
      try { await api(`/samples/${b.dataset.del}`, { method: 'DELETE' }); toast('נמחק'); await reload(); } catch (err) { toast(err.message, 'circle-alert'); }
    };
  });
}

function mediaTab(el, p) {
  el.innerHTML = `<section class="card" style="margin-bottom:24px"><header><h2>פרטים</h2><p>הטלפון משמש לשליחת קישורים בוואטסאפ. השפה קובעת באיזו שפה ייכתבו הפוסטים, ובאיזו שפה ייפתחו עמוד האישור ועמוד הסיפורים.</p></header>
    <div class="body"><div class="grid g2" style="gap:0 24px"><label class="field" style="margin-top:0"><span>טלפון נייד</span><input class="input" id="ph" dir="ltr" inputmode="tel" value="${esc(p.phone ? `+${p.phone}` : '')}" placeholder="050-0000000"></label>
      <label class="field" style="margin-top:0"><span>שפת הכתיבה</span><select class="select" id="lg">${Object.entries(LANG_NAMES).map(([k, v]) => `<option value="${k}" ${p.language === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="btns" style="margin-top:16px"><button type="button" class="btn" id="sd">${icon('save')}<span>שמירה</span></button></div></div></section>
  <div class="grid g2">
    <section class="card"><header><h2>תמונת פרופיל</h2><p>מוצגת רק בתוך מערכת הניהול.</p></header><div class="body">
      <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">${photo(p)}<div><input type="file" id="img" accept="image/png,image/jpeg,image/webp" class="sr"><label for="img" class="btn ghost" style="cursor:pointer">${icon('upload')}<span>${p.image ? 'החלפת התמונה' : 'העלאת תמונה'}</span></label><p class="xs muted" style="margin-top:8px">PNG, JPG או WEBP, עד 8MB.</p></div></div>
      ${p.video ? `<h3 style="margin-top:24px;font-size:16px;color:var(--deep)">סרטון</h3><video src="${esc(p.video)}" controls preload="metadata" style="width:100%;max-height:420px;margin-top:10px;background:#000"></video>` : ''}
    </div></section>
    <section class="card"><header><h2>מחיקת השגריר/ה</h2><p>מוחקת את הפרופיל, הדוגמאות והתמונה. הפוסטים שכבר נכתבו נשארים, כתיעוד של מה שפורסם בשמו/ה.</p></header><div class="body"><button type="button" class="btn danger-ghost" id="del">${icon('trash-2')}<span>מחיקת ${esc(p.name)}</span></button></div></section>
  </div>`;
  $('#sd', el).onclick = async (e) => {
    busy(e.currentTarget, true, 'שומר...');
    try { await api(`/personas/${p.slug}/details`, { method: 'PATCH', body: { phone: $('#ph', el).value, language: $('#lg', el).value } }); toast('נשמר'); go(`/personas/${p.slug}?tab=media`, true); }
    catch (err) { toast(err.message, 'circle-alert'); busy(e.currentTarget, false); }
  };
  $('#img', el).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('image', f);
    try { await api(`/personas/${p.slug}/image`, { form: fd, method: 'POST' }); toast('התמונה עודכנה'); go(`/personas/${p.slug}?tab=media`, true); } catch (err) { toast(err.message, 'circle-alert'); }
  };
  $('#del', el).onclick = async () => {
    if (!(await confirmDanger(`למחוק את ${p.name}?`, 'הפרופיל, דוגמאות הכתיבה והתמונה יימחקו. אי אפשר לבטל, אבל הגיבוי היומי שומר עותק לחודשיים.', 'מחיקה'))) return;
    try { await api(`/personas/${p.slug}`, { method: 'DELETE' }); toast('נמחק'); go('/personas'); } catch (err) { toast(err.message, 'circle-alert'); }
  };
}

// ---------- generate ----------
on('/generate', async (page) => {
  const params = new URLSearchParams(location.search);
  const [personas, topics, settings] = await Promise.all([api('/personas'), api(`/topics?from=${localDay(new Date(Date.now() - 7 * 86400000))}`), api('/settings')]);
  const pre = (params.get('personas') || '').split(',').filter(Boolean);
  const topic = topics.find((t) => String(t.id) === params.get('topic'));
  const story = params.get('story') ? await api(`/stories/${params.get('story')}`).catch(() => null) : null;
  if (story && !pre.includes(story.persona_slug)) pre.push(story.persona_slug);
  page.innerHTML = head('יצירת פוסט', 'המערכת כותבת שלוש גרסאות לכל שגריר/ה ובודקת כמה כל אחת נשמעת כמוהו/ה. בוחרים אחת, משפרים אם צריך, ושומרים כטיוטה. שום דבר לא נשלח בלי שתחליט/י.') + `
    <div class="grid g12">
      <section class="card" style="align-self:start"><header><h2>מה לכתוב</h2></header><div class="body">
        ${story ? `<div class="note" style="margin-bottom:20px">${icon('book-open')}<div style="min-width:0"><b>כותבים מסיפור ששלח/ה השגריר/ה.</b> העובדות שבסיפור נשמרות כמו שהן.<div class="small pre" style="margin-top:6px;max-height:160px;overflow:auto">${esc(story.text)}</div></div></div>` : ''}
        <div class="field" style="margin-top:0"><span>בשם מי</span><div class="pick">${personas.map((p) => `<label><input type="checkbox" value="${p.slug}" ${pre.includes(p.slug) ? 'checked' : ''}>${p.image ? `<img src="${esc(p.image)}" alt="">` : ''}<span>${esc(p.name)}</span></label>`).join('')}</div></div>
        <label class="field"><span>מלוח הנושאים (לא חובה)</span><select class="select" id="tp"><option value="">בלי</option>${topics.map((t) => `<option value="${t.id}" ${topic?.id === t.id ? 'selected' : ''}>${esc(t.title)} · ${fmtDate(t.date)}</option>`).join('')}</select></label>
        <div class="field"><span>פלטפורמה</span><div class="toggles" style="margin-top:0" id="pl">${PLATFORMS.map((x, i) => `<button type="button" class="toggle ${i === 0 ? 'on' : ''}" aria-pressed="${i === 0}" data-v="${x}">${x}</button>`).join('')}</div></div>
        <label class="field"><span>נושא</span><input class="input" id="topic" value="${esc(topic?.title || (story ? 'סיפור מהשטח' : ''))}" placeholder="למשל: עבודה בכללית בזמן מלחמה"></label>
        <label class="field"><span>זווית</span><input class="input" id="angle" value="${esc(topic?.angle || '')}" placeholder="למשל: לגרום לאנשים לרצות לעבוד בכללית"></label>
        <label class="field"><span>טון (לא חובה)</span><select class="select" id="tone">${TONES.map((t) => `<option value="${t}">${t || 'כמו בדרך כלל'}</option>`).join('')}</select></label>
        <label class="field"><span>שפת הפוסט</span><select class="select" id="lang"><option value="">כמו שמוגדר לכל שגריר/ה</option>${Object.entries(LANG_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><span class="hint">פוסט בערבית או ברוסית כדאי שיעבור גם דובר/ת שפת אם לפני פרסום.</span></label>
        <div class="err" id="err" role="alert"></div>
        <button type="button" class="btn wide" id="gen" style="margin-top:24px">${icon('sparkles')}<span>כתיבת שלוש גרסאות</span></button>
        <p class="xs muted" style="margin-top:10px">לוקח בערך דקה לכל שגריר/ה.</p>
      </div></section>
      <div id="out"><div class="card"><div class="empty">בחר/י שגרירים ונושא, והגרסאות יופיעו כאן.</div></div></div>
    </div>`;
  let platform = PLATFORMS[0];
  $$('#pl .toggle', page).forEach((b) => { b.onclick = () => { platform = b.dataset.v; $$('#pl .toggle', page).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); }; });
  $('#tp', page).onchange = (e) => { const t = topics.find((x) => String(x.id) === e.target.value); if (t) { $('#topic', page).value = t.title; if (t.angle) $('#angle', page).value = t.angle; } };
  $('#gen', page).onclick = async (e) => {
    const slugs = $$('.pick input:checked', page).map((x) => x.value);
    const err = $('#err', page); err.textContent = '';
    if (!slugs.length) { err.textContent = 'צריך לבחור לפחות שגריר/ה אחד/ת'; return; }
    if (!$('#topic', page).value.trim()) { err.textContent = 'צריך לכתוב נושא'; $('#topic', page).focus(); return; }
    const btn = e.currentTarget; busy(btn, true, 'כותב...');
    $('#out', page).innerHTML = '<div class="card"><div class="loading"><span class="spin"></span> כותב שלוש גרסאות ובודק את הקול...</div></div>';
    const req = { personaSlugs: slugs, platform, topic: $('#topic', page).value.trim(), angle: $('#angle', page).value.trim(), tone: $('#tone', page).value, topicId: Number($('#tp', page).value) || null, language: $('#lang', page).value || null, storyId: story?.id || null };
    try { const { results } = await api('/generate', { body: req }); showResults($('#out', page), results, req, settings); }
    catch (er) { $('#out', page).innerHTML = `<div class="err">${esc(er.message)}</div>`; }
    busy(btn, false);
  };
});

function showResults(out, results, req, settings) {
  const disclaimer = settings?.disclaimer || 'הדעות כאן שלי, ואינן ייעוץ רפואי אישי.';
  out.innerHTML = results.map((r, ri) => `<section class="card" style="margin-bottom:24px" data-r="${ri}"><header><h2>${esc(r.name || r.slug)}</h2>${r.error ? '' : `<p>בחר/י גרסה, ואפשר לערוך אותה לפני השמירה.${r.language && r.language !== 'he' ? ` הפוסט ב${LANG_NAMES[r.language]}: כדאי שדובר/ת שפת אם יעבור/תעבור עליו.` : ''}</p>`}</header><div class="body">
    ${r.error ? `<div class="err" style="margin-top:0">${esc(r.error)}</div>` : `<div class="variants">${r.variants.map((v, i) => `<div class="variant" data-v="${i}"><header><div class="approach">${esc(v.approach || `גרסה ${i + 1}`)}</div>${v.score ? `<div class="score"><span class="bar" aria-hidden="true"><i style="width:${v.score * 10}%"></i></span><b>דומה לקול: ${v.score} מתוך 10</b></div><div class="xs muted">${esc(v.reason)}</div>` : '<div class="xs muted">לא התקבל ציון קול לגרסה הזו.</div>'}
      ${v.unverified?.length ? `<div class="xs" style="color:var(--warn)">${icon('circle-alert', 'sm')} ${v.unverified.length} פרטים בלי מקור, יישלחו לאישור השגריר/ה</div>` : ''}</header><div class="text">${esc(v.text)}</div><footer><button type="button" class="btn sm ghost wide" data-choose>בחירה בגרסה הזו</button></footer></div>`).join('')}</div>
    <div data-editor style="display:none;margin-top:20px">
      <div data-unv></div>
      <label class="field" style="margin-top:0"><span>הנוסח שנבחר (אפשר לערוך)</span><textarea class="textarea tall" data-text></textarea></label>
      <label data-disc style="display:none;margin-top:12px;align-items:center;gap:10px;min-height:48px;cursor:pointer"><input type="checkbox" data-disccb style="width:20px;height:20px;accent-color:var(--teal)"><span>להוסיף שורת הסתייגות בסוף: "${esc(disclaimer)}"<span class="xs muted" style="display:block">הפוסט עוסק בנושא רפואי.</span></span></label>
      <label style="display:flex;margin-top:12px;align-items:center;gap:10px;min-height:48px;cursor:pointer"><input type="checkbox" data-alts style="width:20px;height:20px;accent-color:var(--teal)"><span>לתת לשגריר/ה לבחור בין שלוש הגרסאות<span class="xs muted" style="display:block">הנוסח שבחרת יופיע ראשון, והשניים האחרים כאפשרות בעמוד האישור.</span></span></label>
      <label class="field" style="max-width:260px"><span>תאריך פרסום מתוכנן (לא חובה)</span><input class="input" type="date" data-date></label>
      <div class="btns" style="margin-top:16px"><button type="button" class="btn" data-save>${icon('save')}<span>שמירה כטיוטה</span></button><button type="button" class="btn ghost" data-savesend>${icon('send')}<span>שמירה ושליחה לאישור</span></button><button type="button" class="btn ghost" data-copy>${icon('copy')}<span>העתקה</span></button></div></div>`}
  </div></section>`).join('');
  $$('[data-r]', out).forEach((sec) => {
    const r = results[Number(sec.dataset.r)];
    if (r.error) return;
    let chosen = null;
    $$('[data-choose]', sec).forEach((b) => {
      b.onclick = () => {
        const card = b.closest('.variant'); chosen = Number(card.dataset.v);
        const v = r.variants[chosen];
        $$('.variant', sec).forEach((x) => x.classList.toggle('chosen', x === card));
        $$('[data-choose]', sec).forEach((x) => { x.textContent = x === b ? 'נבחרה' : 'בחירה בגרסה הזו'; x.className = x === b ? 'btn sm wide' : 'btn sm ghost wide'; });
        $('[data-editor]', sec).style.display = 'block';
        $('[data-text]', sec).value = v.text;
        $('[data-unv]', sec).innerHTML = v.unverified?.length ? `<div class="warnbox" style="margin-bottom:16px"><b>פרטים בלי מקור בחומר של השגריר/ה.</b> עדיף למחוק או לנסח כללי. מה שיישאר יופיע לשגריר/ה כ"פרטים לבדיקה" בעמוד האישור:<ul class="confirm">${v.unverified.map((u) => `<li>"${esc(u)}"</li>`).join('')}</ul></div>` : '';
        $('[data-disc]', sec).style.display = v.medical ? 'flex' : 'none';
        $('[data-disccb]', sec).checked = false;
        $('[data-text]', sec).focus();
      };
    });
    const finalText = () => { const t = $('[data-text]', sec).value.trim(); return $('[data-disccb]', sec).checked && !t.includes(disclaimer) ? `${t}\n\n${disclaimer}` : t; };
    const save = async (btn, andSend) => {
      busy(btn, true, 'שומר...');
      const v = r.variants[chosen];
      const text = finalText();
      try {
        const { id, conflicts } = await api('/posts', { body: { personaSlug: r.slug, topic: req.topic, platform: req.platform, goal: req.angle, body: text, scheduledFor: $('[data-date]', sec).value || null, voiceScore: v.score || null, voiceReason: v.reason || null, topicId: req.topicId, confirm: (v.unverified || []).filter((u) => text.includes(u)), medical: v.medical, language: r.language, storyId: req.storyId, alternatives: $('[data-alts]', sec).checked ? r.variants.filter((_, i) => i !== chosen).map((o) => o.text) : [] } });
        conflictWarn(conflicts);
        busy(btn, true, 'בודק בטיחות...');
        const { flags } = await api(`/posts/${id}/check`, { method: 'POST' }).catch(() => ({ flags: null }));
        if (andSend) {
          const go2 = !flags?.length || (await modal({ title: 'לפני ששולחים: כדאי לבדוק', body: `<p class="small muted" style="margin-bottom:12px">בדיקת הבטיחות מצאה ${flags.length} דברים לבדיקה. הפוסט נשמר כטיוטה. אפשר לשלוח בכל זאת, או לערוך קודם בעמוד השגריר/ה.</p>${flagsHtml(flags)}`, actions: [{ label: 'לעריכה בעמוד השגריר/ה', cls: 'ghost', value: false }, { label: 'שליחה בכל זאת', value: true }] }));
          if (!go2) { go(`/personas/${r.slug}`); return; }
          const s = await api(`/posts/${id}/send`, { method: 'POST' }); await copyText(s.reviewUrl);
          const persona = await api(`/personas/${r.slug}`);
          afterSend({ personaName: r.name }, s.reviewUrl, persona.phone);
        }
        $('[data-editor]', sec).innerHTML = `<div class="note ok">${icon('circle-check')}<div>${andSend ? 'נשמר ונשלח לאישור. הקישור לשגריר/ה הועתק.' : 'נשמר כטיוטה.'} <a class="link" href="/personas/${r.slug}">לעמוד השגריר/ה</a></div></div>${!andSend && flags ? `<div style="margin-top:12px">${flagsHtml(flags)}</div>` : ''}`;
      } catch (e) { toast(e.message, 'circle-alert'); busy(btn, false); }
    };
    $('[data-save]', sec).onclick = (e) => save(e.currentTarget, false);
    $('[data-savesend]', sec).onclick = (e) => save(e.currentTarget, true);
    $('[data-copy]', sec).onclick = async () => { if (await copyText(finalText())) toast('הועתק'); };
  });
}

// ---------- calendar of posts ----------
on('/calendar', async (page) => {
  const month = new URLSearchParams(location.search).get('month') || localDay().slice(0, 7);
  const d = await api(`/calendar?month=${month}`);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
  const shift = (n) => { const t = new Date(y, m - 1 + n, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
  const todayStr = localDay();
  const byDay = {};
  for (const p of d.posts) { const k = p.scheduledFor || (p.publishedAt || '').slice(0, 10); (byDay[k] ||= []).push({ t: 'post', p }); }
  for (const t of d.topics) (byDay[t.date] ||= []).push({ t: 'topic', x: t });
  const cell = (it) => it.t === 'topic'
    ? `<a class="ev topic" href="/generate?topic=${it.x.id}">${icon('megaphone', 'sm')} ${esc(it.x.title)}</a>`
    : `<a class="ev ${it.p.publishedAt ? 'done' : ''}" href="/personas/${it.p.personaSlug}">${esc(it.p.personaName || '')}: ${esc(it.p.topic || '')}</a>`;
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push('<div class="day out" aria-hidden="true"></div>');
  for (let day = 1; day <= days; day++) {
    const k = `${month}-${String(day).padStart(2, '0')}`;
    const dayPosts = (byDay[k] || []).filter((it) => it.t === 'post' && it.p.scheduledFor === k);
    const clash = dayPosts.some((a, i) => dayPosts.some((b, j) => j > i && a.p.personaSlug !== b.p.personaSlug && ((a.p.topicId && a.p.topicId === b.p.topicId) || a.p.topic === b.p.topic)));
    cells.push(`<div class="day ${k === todayStr ? 'today' : ''}"><b>${day}</b>${(byDay[k] || []).map(cell).join('')}${clash ? `<span class="ev" style="background:var(--warn-bg);color:#6b4a00;cursor:default">${icon('circle-alert', 'sm')} אותו נושא אצל שני שגרירים</span>` : ''}</div>`);
  }
  while (cells.length % 7) cells.push('<div class="day out" aria-hidden="true"></div>');
  const agendaDays = Object.keys(byDay).sort();
  page.innerHTML = head('לוח פרסומים', 'פוסטים לפי תאריך הפרסום המתוכנן, לצד הנושאים מלוח הנושאים. פוסט שסומן כפורסם מופיע בכהה.', `<a class="btn ghost sm" href="/calendar?month=${shift(-1)}">${icon('chevron-right', 'sm')}<span>החודש הקודם</span></a><b style="font-size:18px;color:var(--deep);min-width:120px;text-align:center">${MONTHS[m - 1]} ${y}</b><a class="btn ghost sm" href="/calendar?month=${shift(1)}"><span>החודש הבא</span>${icon('chevron-left', 'sm')}</a>`) + `
    <div class="cal">${['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((n) => `<div class="dow">יום ${n}</div>`).join('')}${cells.join('')}</div>
    <div class="agenda card">${agendaDays.length ? `<div class="rows">${agendaDays.map((k) => `<div style="display:block"><div class="t" style="margin-bottom:6px">${fmtDate(k)}</div>${byDay[k].map(cell).join('')}</div>`).join('')}</div>` : '<div class="empty">אין פוסטים או נושאים בחודש הזה.</div>'}</div>
    <section class="card" style="margin-top:28px"><header><h2>בלי תאריך</h2><p>פוסטים שנשלחו או אושרו ועוד לא קיבלו תאריך פרסום. אפשר לתזמן מעמוד השגריר/ה.</p></header>
      <div class="body flush rows">${d.unscheduled.length ? d.unscheduled.map((p) => `<a href="/personas/${p.personaSlug}"><div class="grow"><div class="t">${esc(p.topic || 'בלי נושא')}</div><div class="d">${esc(p.personaName || '')}</div></div><span class="end">${statusChip(p)}</span></a>`).join('') : '<div class="empty">הכל מתוזמן.</div>'}</div></section>`;
});

// ---------- topics ----------
on('/topics', async (page) => {
  const list = await api(`/topics?from=${localDay(new Date(Date.now() - 30 * 86400000))}`);
  page.innerHTML = head('לוח נושאים', 'חגים, אירועים וקמפיינים של כללית שכדאי לכתוב עליהם. מכל נושא אפשר ליצור פוסט בלחיצה, והוא מופיע בלוח הפרסומים.', `<button type="button" class="btn" id="add">${icon('plus')}<span>נושא חדש</span></button>`) + `
    <section class="card"><div class="body flush rows">${list.length ? list.map((t) => `<div data-id="${t.id}"><div class="grow"><div class="t">${esc(t.title)}</div><div class="d">${fmtDate(t.date)} · ${KIND[t.kind] || ''}${t.angle ? ` · ${esc(t.angle)}` : ''}</div>${t.notes ? `<div class="d pre" style="margin-top:4px">${esc(t.notes)}</div>` : ''}</div>
      <span class="end"><a class="btn sm" href="/generate?topic=${t.id}">${icon('sparkles', 'sm')}<span>פוסט על זה</span></a><button type="button" class="btn sm ghost" data-edit>${icon('pencil', 'sm')}<span>עריכה</span></button><button type="button" class="btn sm danger-ghost" data-del aria-label="מחיקת ${esc(t.title)}">${icon('trash-2', 'sm')}</button></span></div>`).join('') : '<div class="empty">עוד אין נושאים. כדאי להתחיל מהחגים והאירועים של החודשיים הקרובים.</div>'}</div></section>`;
  const form = (t = {}) => modal({ title: t.id ? 'עריכת נושא' : 'נושא חדש', body: `
    <label class="field" style="margin-top:0"><span>שם הנושא</span><input class="input" id="tt" value="${esc(t.title || '')}" placeholder="למשל: יום האחות הבינלאומי"></label>
    <div class="grid g2" style="gap:0 16px"><label class="field"><span>תאריך</span><input class="input" type="date" id="td" value="${esc(t.date || '')}"></label>
    <label class="field"><span>סוג</span><select class="select" id="tk">${Object.entries(KIND).map(([k, l]) => `<option value="${k}" ${t.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <label class="field"><span>זווית לפוסטים (לא חובה)</span><input class="input" id="ta" value="${esc(t.angle || '')}" placeholder="מה חשוב שהפוסט יעביר"></label>
    <label class="field"><span>הערות (לא חובה)</span><textarea class="textarea" id="tn" rows="3">${esc(t.notes || '')}</textarea></label>`,
    actions: [{ label: 'ביטול', cls: 'ghost', value: null }, { label: 'שמירה', collect: (m) => ({ title: $('#tt', m).value, date: $('#td', m).value, kind: $('#tk', m).value, angle: $('#ta', m).value, notes: $('#tn', m).value }) }] });
  const saveTopic = async (t, id) => {
    if (!t) return;
    try { await api(id ? `/topics/${id}` : '/topics', { method: id ? 'PATCH' : 'POST', body: t }); toast('נשמר'); go('/topics', true); } catch (e) { toast(e.message, 'circle-alert'); }
  };
  $('#add', page).onclick = async () => saveTopic(await form());
  $$('[data-id]', page).forEach((row) => {
    const t = list.find((x) => x.id === Number(row.dataset.id));
    $('[data-edit]', row).onclick = async () => saveTopic(await form(t), t.id);
    $('[data-del]', row).onclick = async () => {
      if (!(await confirmDanger('למחוק את הנושא?', `"${t.title}" יימחק מלוח הנושאים. פוסטים שכבר נכתבו עליו נשארים.`, 'מחיקה'))) return;
      try { await api(`/topics/${t.id}`, { method: 'DELETE' }); toast('נמחק'); go('/topics', true); } catch (e) { toast(e.message, 'circle-alert'); }
    };
  });
});

// ---------- candidates ----------
on('/candidates', async (page) => {
  const list = await api('/candidates');
  setCounts({ newCandidates: list.filter((c) => c.status === 'new').length });
  const link = `${location.origin}/onboarding`;
  page.innerHTML = head('מועמדים', 'עובדים שמילאו את שאלון ההיכרות. מכל שאלון אפשר לבנות טיוטת פרופיל קול ולהפוך אותו לשגריר/ה.') + `
    <div class="linkbox" style="margin-bottom:24px">${icon('link', 'sm')}<span class="nowrap">הקישור לשאלון:</span><code>${esc(link)}</code><button type="button" class="btn sm ghost" id="cp">העתקת הקישור</button><a class="btn sm ghost" href="/onboarding" target="_blank" rel="noopener">פתיחה</a></div>
    <section class="card"><div class="body flush rows">${list.length ? list.map((c) => `<a href="/candidates/${c.slug}"><div class="grow"><div class="t">${esc(c.name)}</div><div class="d">${esc([c.role, c.company].filter(Boolean).join(' · '))} · ${fmtWhen(c.submittedAt)}</div></div><span class="end"><span class="small muted nowrap">${c.answeredCount} מתוך ${c.totalQuestions}</span><span class="chip ${CAND_STATUS[c.status]?.[1] || 'plain'}">${CAND_STATUS[c.status]?.[0] || c.status}</span></span></a>`).join('') : '<div class="empty">עוד אף אחד לא מילא את השאלון.</div>'}</div></section>`;
  $('#cp', page).onclick = async () => { if (await copyText(link)) toast('הקישור הועתק'); };
});

on('/candidates/([a-z0-9-]+)', async (page, slug) => {
  const c = await api(`/candidates/${slug}`);
  if (c.status === 'new') { api(`/candidates/${slug}`, { method: 'PATCH', body: { status: 'reviewed' } }).catch(() => {}); c.status = 'reviewed'; }
  page.innerHTML = crumb('/candidates', 'כל המועמדים') + head(c.name, `${esc([c.role, c.company].filter(Boolean).join(' · '))}${c.email ? ` · <span dir="ltr">${esc(c.email)}</span>` : ''} · מילא/ה ${fmtDate(c.submittedAt)} · ${c.answeredCount} מתוך ${c.totalQuestions} תשובות`, `<span class="chip ${CAND_STATUS[c.status]?.[1]}">${CAND_STATUS[c.status]?.[0]}</span>`) + `
    <div class="grid g21">
      <div>${SECTIONS.map((s, i) => `<section class="card" style="margin-bottom:20px"><header><h2>חלק ${i + 1}: ${esc(s.title)}</h2></header><div class="body">${s.questions.map((q) => `<div style="padding:12px 0;border-top:1px solid var(--g100)"><div class="small" style="font-weight:600">${esc(q.text)}</div><div class="pre" style="margin-top:6px">${c.answers[q.id] ? esc(c.answers[q.id]) : '<span class="muted">לא נענה</span>'}</div></div>`).join('')}</div></section>`).join('')}</div>
      <div class="grid" style="align-content:start">
        <section class="card teal"><header><h2>בניית שגריר/ה מהשאלון</h2></header><div class="body"><p>מודל ה-AI כותב טיוטת פרופיל קול מתוך התשובות (בלי המייל). את/ה קורא/ת, מתקן/ת ושומר/ת.</p><button type="button" class="btn ghost" style="margin-top:16px" id="draft">${icon('wand-sparkles')}<span>כתיבת טיוטת פרופיל</span></button></div></section>
        <section class="card"><header><h2>סטטוס</h2></header><div class="body"><select class="select" id="st" aria-label="סטטוס">${Object.entries(CAND_STATUS).map(([k, [l]]) => `<option value="${k}" ${c.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></section>
        <section class="card"><header><h2>מחיקה לפי בקשה</h2><p>מוחקת את כל התשובות ופרטי הקשר. שגריר/ה שכבר נבנה/תה מהשאלון לא נמחק/ת.</p></header><div class="body"><button type="button" class="btn danger-ghost" id="del">${icon('trash-2')}<span>מחיקת השאלון</span></button></div></section>
      </div>
    </div>
    <div id="dr"></div>`;
  $('#st', page).onchange = async (e) => { try { await api(`/candidates/${slug}`, { method: 'PATCH', body: { status: e.target.value } }); toast('הסטטוס עודכן'); } catch (er) { toast(er.message, 'circle-alert'); } };
  $('#del', page).onclick = async () => {
    if (!(await confirmDanger('למחוק את השאלון?', `כל התשובות ופרטי הקשר של ${c.name} יימחקו מהמערכת. אי אפשר לבטל.`, 'מחיקה'))) return;
    try { await api(`/candidates/${slug}`, { method: 'DELETE' }); toast('השאלון נמחק'); go('/candidates'); } catch (e) { toast(e.message, 'circle-alert'); }
  };
  $('#draft', page).onclick = async (e) => {
    const btn = e.currentTarget; busy(btn, true, 'כותב טיוטה...');
    try {
      const { draft } = await api(`/candidates/${slug}/persona-draft`, { method: 'POST' });
      const dr = $('#dr', page);
      dr.innerHTML = `<section class="card" style="margin-top:28px"><header><h2>טיוטת פרופיל הקול</h2><p>לקרוא בעיון ולתקן כל מה שלא מדויק. אחרי השמירה ${esc(c.name)} יופיע/תופיע ברשימת השגרירים, ואפשר יהיה להוסיף דוגמאות כתיבה.</p></header>
        <div class="body"><textarea class="textarea code" id="pd" style="min-height:60vh" aria-label="טיוטה">${esc(draft)}</textarea>
        <div class="btns" style="margin-top:16px"><button type="button" class="btn go" id="sp">${icon('check')}<span>שמירה כשגריר/ה</span></button><button type="button" class="btn ghost" id="cpd">${icon('copy')}<span>העתקה</span></button></div></div></section>`;
      dr.scrollIntoView({ behavior: 'smooth' });
      $('#cpd', dr).onclick = async () => { if (await copyText($('#pd', dr).value)) toast('הועתק'); };
      $('#sp', dr).onclick = async (ev) => {
        busy(ev.currentTarget, true, 'שומר...');
        try { const r = await api(`/candidates/${slug}/save-persona`, { body: { profileMarkdown: $('#pd', dr).value } }); toast('נוסף/ה לשגרירים'); go(`/personas/${r.slug}?tab=samples`); }
        catch (er) { toast(er.message, 'circle-alert'); busy(ev.currentTarget, false); }
      };
    } catch (er) { toast(er.message, 'circle-alert'); }
    busy(btn, false);
  };
});

// ---------- activity ----------
on('/activity', async (page) => {
  const list = await api('/activity');
  page.innerHTML = head('מה קרה לאחרונה', 'כל שאלון שהתקבל, כל פוסט שנשלח, אושר או פורסם. גם כשאין התראות במייל, הכל נרשם כאן.') +
    `<section class="card"><div class="body flush rows">${list.length ? list.map((a) => `<${a.link ? `a href="${esc(a.link)}"` : 'div'}><div class="grow"><div>${esc(a.message)}</div><div class="d">${fmtWhen(a.at)}</div></div></${a.link ? 'a' : 'div'}>`).join('') : '<div class="empty">עוד אין פעילות.</div>'}</div></section>`;
});

// ---------- backup ----------
on('/backup', async (page) => {
  const d = await api('/backup/status');
  page.innerHTML = head('גיבוי', 'כל לילה נשמר עותק מלא של כל הנתונים, ונשמרים 60 העותקים האחרונים. אפשר גם להוריד עותק למחשב ולשחזר ממנו.') + `
    <div class="kpis">
      <div class="kpi"><div class="v">${d.current.personas}</div><div class="l">שגרירים</div></div>
      <div class="kpi"><div class="v">${d.current.candidates}</div><div class="l">מועמדים</div></div>
      <div class="kpi"><div class="v">${d.current.posts}</div><div class="l">פוסטים</div></div>
      <div class="kpi"><div class="v">${d.current.topics}</div><div class="l">נושאים</div></div>
    </div>
    <div class="grid g2">
      <section class="card"><header><h2>עותקים שמורים</h2><p>${d.backups.length ? `האחרון מ${fmtDate(d.backups[0].name.slice(0, 10))}.` : 'עוד לא נשמר עותק. הראשון יישמר הלילה, או עכשיו בלחיצה.'}</p></header>
        <div class="body"><div class="btns"><button type="button" class="btn" id="run">${icon('save')}<span>גיבוי עכשיו</span></button><a class="btn ghost" href="/api/backup/export" download>${icon('download')}<span>הורדה למחשב</span></a></div></div>
        <div class="body flush rows">${d.backups.map((b) => `<div><div class="grow"><div class="t">${fmtDate(b.name.slice(0, 10))}</div><div class="d">${Math.max(1, Math.round(b.size / 1024))} קילובייט</div></div><span class="end"><a class="btn sm ghost" href="/api/backup/file/${b.name}" download>${icon('download', 'sm')}<span>הורדה</span></a></span></div>`).join('')}</div></section>
      <section class="card"><header><h2>שחזור מקובץ</h2><p>מוסיף רק מה שחסר. רשומה שכבר קיימת לא נדרסת, כך ששחזור של גיבוי ישן לא מוחק עבודה חדשה.</p></header>
        <div class="body"><input type="file" id="f" accept="application/json,.json" class="sr"><label for="f" class="btn ghost" style="cursor:pointer">${icon('upload')}<span>בחירת קובץ גיבוי</span></label><div id="res" style="margin-top:14px"></div></div></section>
    </div>
    <p class="xs muted" style="margin-top:20px">תמונות וסרטונים שמורים בנפרד באחסון הקבצים, ואינם חלק מקובץ הגיבוי.</p>`;
  $('#run', page).onclick = async (e) => {
    busy(e.currentTarget, true, 'מגבה...');
    try { await api('/backup/run', { method: 'POST' }); toast('הגיבוי נשמר'); go('/backup', true); } catch (er) { toast(er.message, 'circle-alert'); busy(e.currentTarget, false); }
  };
  $('#f', page).onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    let snap; try { snap = JSON.parse(await file.text()); } catch { $('#res', page).innerHTML = '<div class="err">הקובץ אינו קובץ גיבוי תקין</div>'; return; }
    if (!(await modal({ title: 'לשחזר מהקובץ?', narrow: true, body: `<p>יתווספו רשומות שחסרות כרגע. שום דבר קיים לא יימחק ולא ישתנה.</p>`, actions: [{ label: 'ביטול', cls: 'ghost', value: false }, { label: 'שחזור', value: true }] }))) return;
    try { const r = await api('/backup/import', { body: { snapshot: snap } }); $('#res', page).innerHTML = `<div class="note ok">${icon('circle-check')}<div>השחזור הסתיים. נוספו ${r.written} רשומות.</div></div>`; }
    catch (er) { $('#res', page).innerHTML = `<div class="err">${esc(er.message)}</div>`; }
  };
});
