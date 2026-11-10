// The two pages people outside the team see: the candidate questionnaire and the ambassador's
// review page. No navigation, nothing that hints an admin area exists.
import { $, $$, esc, icon, stripe, api, on, copyText, busy, toast } from '/core.js';
import { QUESTIONNAIRE_SECTIONS as SECTIONS, TOTAL_QUESTIONS } from '/questionnaire.js';

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'];
const STORE = 'ambassador-questionnaire-v1';

function frame(title, sub, inner, short = false) {
  return `<div class="pub">
    <header class="brandhead"><div class="wrap"><img class="logo" src="/img/clalit-logo-white.svg" alt="כללית">
      <h1>${title.map((t) => `<span>${esc(t)}</span>`).join('')}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></header>
    ${stripe()}
    <main class="${short ? 'short' : ''}"><div class="wrap" id="pubmain">${inner}</div></main>
    <footer class="wrap foot-legal">שירותי בריאות כללית · תוכנית השגרירים הדיגיטליים</footer>
  </div>`;
}

// ---------- questionnaire ----------
on('/onboarding', (root) => {
  document.title = 'שאלון היכרות · שגרירי כללית';
  const blank = { step: 0, name: '', englishName: '', role: '', company: '', email: '', answers: {}, choices: {}, details: {} };
  let s = blank, restored = false;
  try { const saved = JSON.parse(localStorage.getItem(STORE) || 'null'); if (saved && typeof saved === 'object') { s = { ...blank, ...saved }; restored = true; } } catch { /* private mode: still works, just without autosave */ }
  let cfg = { turnstileSiteKey: null };
  api('/public/config').then((c) => { cfg = c; }).catch(() => {});

  const last = SECTIONS.length + 1; // 0 intro, 1..N sections, N+1 review
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* ignore */ } };
  const answered = () => Object.values(s.answers).filter((a) => a && a.trim()).length;
  const compose = (sel, detail) => { const h = sel.join(', '), t = (detail || '').trim(); return h && t ? `${h}\n\n${t}` : h || t; };
  const showDetail = (q) => { const sel = s.choices[q.id] || []; if (!q.detailPrompt || !sel.length) return false; return !q.detailWhen || sel.some((x) => q.detailWhen.includes(x)); };

  root.innerHTML = frame(['שאלון היכרות', 'לשגרירות דיגיטלית'], 'כדי שנוכל לכתוב בשמך, בקול שלך', '');
  const main = $('#pubmain');

  function progress() {
    const inSection = s.step >= 1 && s.step <= SECTIONS.length;
    const pct = Math.round((answered() / TOTAL_QUESTIONS) * 100);
    const label = s.step === 0 ? 'לפני שמתחילים' : inSection ? `חלק ${LETTERS[s.step - 1]} מתוך ${LETTERS[SECTIONS.length - 1]}` : 'סקירה ושליחה';
    return `<div class="progress"><div class="row"><b>${label}</b><span>${answered()} מתוך ${TOTAL_QUESTIONS} שאלות נענו</span></div><div class="track" aria-hidden="true"><i style="width:${pct}%"></i></div></div>`;
  }

  function bottom() {
    const nextLabel = s.step === 0 ? `המשך לחלק ${LETTERS[0]}` : s.step < SECTIONS.length ? `המשך לחלק ${LETTERS[s.step]}` : s.step === SECTIONS.length ? 'לסקירה ושליחה' : 'שליחת השאלון';
    return `<div class="bottombar"><div class="wrap">
      ${s.step > 0 ? `<button type="button" class="btn ghost" id="back">${icon('chevron-right')}<span>חזרה</span></button>` : ''}
      <div class="grow"><span class="saved">${icon('circle-check', 'sm')}התשובות נשמרות אוטומטית</span></div>
      <button type="button" class="btn next ${s.step === last ? 'go' : ''}" id="next"><span>${nextLabel}</span>${s.step === last ? icon('send') : icon('chevron-left')}</button>
    </div></div>`;
  }

  function intro() {
    return `${restored && (s.name || answered()) ? `<div class="note ok" style="margin-bottom:24px">${icon('circle-check')}<div><b>ממשיכים מאיפה שעצרת.</b> התשובות שכבר כתבת נשמרו במכשיר הזה. <button type="button" class="link" id="restart">להתחיל מההתחלה</button></div></div>` : ''}
      <h2>לפני שמתחילים</h2>
      <p class="lead">כדי לכתוב בשמך באופן אמיתי, אנחנו צריכים להכיר אותך, לא רק את התפקיד. ככל שתכתוב/י בשפה שלך, בלי "לנסח יפה", כך הפוסטים יישמעו יותר כמוך. אין תשובות נכונות, ואפשר לדלג על כל שאלה ולחזור אליה.</p>
      <div class="note" style="margin-top:20px">${icon('shield-check')}<div><b>שום דבר לא מתפרסם בשמך בלי האישור שלך.</b> כל פוסט נשלח אליך בקישור אישי, ואפשר לאשר אותו, לערוך או לא לאשר בכלל.</div></div>
      <label class="field"><span>שם מלא</span><input class="input" data-k="name" value="${esc(s.name)}" autocomplete="name" placeholder="לדוגמה: דנה כהן"></label>
      <label class="field"><span>שם באנגלית</span><input class="input" data-k="englishName" value="${esc(s.englishName)}" dir="ltr" autocomplete="off" placeholder="Dana Cohen"><span class="hint">משמש רק ליצירת כתובת נקייה לפרופיל שלך במערכת.</span></label>
      <label class="field"><span>תפקיד</span><input class="input" data-k="role" value="${esc(s.role)}" placeholder="לדוגמה: אחות במחלקה פנימית"></label>
      <label class="field"><span>מקום עבודה</span><input class="input" data-k="company" value="${esc(s.company)}" placeholder="לדוגמה: כללית, סורוקה"></label>
      <label class="field"><span>מייל (לא חובה)</span><input class="input" type="email" data-k="email" value="${esc(s.email)}" dir="ltr" autocomplete="email" placeholder="name@example.com"><span class="hint">כדי שנוכל לחזור אליך. המייל לא נשלח לשום כלי AI.</span></label>
      <label class="hp" aria-hidden="true">אתר אינטרנט<input tabindex="-1" autocomplete="off" id="website"></label>
      <details class="note" style="margin-top:28px;display:block">
        <summary style="cursor:pointer;font-weight:600;min-height:32px">מה נשמר, ומי רואה את זה</summary>
        <div class="small" style="margin-top:10px;display:grid;gap:8px">
          <p>התשובות נשמרות במערכת של תוכנית השגרירים, ורק צוות התוכנית יכול לקרוא אותן.</p>
          <p>כדי לבנות טיוטה של פרופיל הכתיבה שלך, התשובות עוברות לכלי AI, בלי המייל. אדם מהצוות קורא ומתקן את הטיוטה, ושום דבר לא מתפרסם ממנה ישירות.</p>
          <p>עד השליחה, הטיוטה נשמרת רק במכשיר הזה. אפשר לבקש בכל שלב למחוק את כל התשובות, מול מי ששלח/ה אליך את השאלון.</p>
        </div>
      </details>
      <div class="err" id="err" role="alert"></div>`;
  }

  function question(q, i) {
    const n = i + 1;
    if (!q.kind || q.kind === 'text') {
      return `<div class="q"><label><div class="qt"><span class="n">${n}.</span><span>${esc(q.text)}</span></div>
        <textarea class="textarea" data-q="${q.id}" rows="4">${esc(s.answers[q.id] || '')}</textarea></label></div>`;
    }
    const sel = s.choices[q.id] || [];
    return `<div class="q" role="group" aria-labelledby="t-${q.id}"><div class="qt" id="t-${q.id}"><span class="n">${n}.</span><span>${esc(q.text)}</span></div>
      <div class="toggles">${q.options.map((o) => `<button type="button" class="toggle ${sel.includes(o) ? 'on' : ''}" aria-pressed="${sel.includes(o)}" data-opt="${q.id}" data-v="${esc(o)}">${sel.includes(o) ? icon('check', 'sm') : ''}${esc(o)}</button>`).join('')}</div>
      ${q.kind === 'multi' ? '<p class="xs muted" style="margin-top:8px">אפשר לבחור כמה.</p>' : ''}
      ${showDetail(q) ? `<label class="detail"><span>${esc(q.detailPrompt)}</span><textarea class="textarea" data-detail="${q.id}" rows="3">${esc(s.details[q.id] || '')}</textarea></label>` : ''}
    </div>`;
  }

  function section(idx) {
    const sec = SECTIONS[idx];
    return `<h2>${esc(sec.title)}</h2><p class="lead">${esc(sec.description)}</p>
      <div style="margin-top:8px">${sec.questions.map(question).join('')}</div>
      ${idx === SECTIONS.length - 1 ? `<div class="note" style="margin-top:8px">${icon('shield-check')}<div>שום דבר לא מתפרסם בשמך בלי האישור שלך.</div></div>` : ''}`;
  }

  function review() {
    const missing = TOTAL_QUESTIONS - answered();
    return `<h2>סקירה ושליחה</h2>
      <p class="lead">ענית על ${answered()} מתוך ${TOTAL_QUESTIONS} שאלות.${missing ? ' אפשר לשלוח כבר עכשיו, או לחזור ולהשלים.' : ' תודה שענית על הכל.'}</p>
      <div class="card" style="margin-top:20px"><div class="rows">${SECTIONS.map((sec, i) => {
        const done = sec.questions.filter((q) => (s.answers[q.id] || '').trim()).length;
        return `<button type="button" class="go" data-jump="${i + 1}" style="width:100%;border:0;background:none;text-align:start;cursor:pointer;font:inherit">
          <div class="grow"><div class="t">חלק ${LETTERS[i]}: ${esc(sec.title)}</div><div class="d">${done} מתוך ${sec.questions.length} שאלות</div></div>
          <span class="end">${done === sec.questions.length ? '<span class="chip ok">הושלם</span>' : '<span class="chip warn">אפשר להשלים</span>'}${icon('chevron-left', 'sm')}</span></button>`;
      }).join('')}</div></div>
      <div class="note" style="margin-top:20px">${icon('shield-check')}<div><b>מה קורה אחרי השליחה:</b> צוות התוכנית יבנה מהתשובות פרופיל כתיבה, וכל פוסט שייכתב בשמך יישלח אליך לאישור לפני שהוא עולה.</div></div>
      <div id="ts" style="margin-top:20px"></div>
      <div class="err" id="err" role="alert"></div>`;
  }

  function draw() {
    const body = s.step === 0 ? intro() : s.step <= SECTIONS.length ? section(s.step - 1) : review();
    main.innerHTML = progress() + body + bottom();
    bind();
    if (s.step === last && cfg.turnstileSiteKey) mountTurnstile();
  }

  function setStep(n) { s.step = Math.max(0, Math.min(last, n)); save(); draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function bind() {
    $$('[data-k]', main).forEach((el) => { el.oninput = () => { s[el.dataset.k] = el.value; save(); }; });
    $$('[data-q]', main).forEach((el) => { el.oninput = () => { s.answers[el.dataset.q] = el.value; save(); refreshCount(); }; });
    $$('[data-detail]', main).forEach((el) => {
      el.oninput = () => { const id = el.dataset.detail; s.details[id] = el.value; s.answers[id] = compose(s.choices[id] || [], el.value); save(); };
    });
    $$('[data-opt]', main).forEach((el) => {
      el.onclick = () => {
        const id = el.dataset.opt, v = el.dataset.v;
        const q = SECTIONS.flatMap((x) => x.questions).find((x) => x.id === id);
        const cur = s.choices[id] || [];
        const next = q.kind === 'multi' ? (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) : (cur.includes(v) ? [] : [v]);
        s.choices[id] = next;
        // Dropping the option that asked for detail drops the now-stale detail too.
        if (!(next.length && (!q.detailWhen || next.some((x) => q.detailWhen.includes(x))))) s.details[id] = '';
        s.answers[id] = compose(next, s.details[id]);
        save();
        const y = window.scrollY; draw(); window.scrollTo(0, y);
        $(`[data-opt="${id}"][data-v="${CSS.escape(v)}"]`, main)?.focus();
      };
    });
    $$('[data-jump]', main).forEach((el) => { el.onclick = () => setStep(Number(el.dataset.jump)); });
    $('#restart', main)?.addEventListener('click', () => { s = { ...blank, answers: {}, choices: {}, details: {} }; restored = false; try { localStorage.removeItem(STORE); } catch { /* ignore */ } draw(); });
    $('#back', main)?.addEventListener('click', () => setStep(s.step - 1));
    $('#next', main).onclick = () => (s.step === last ? submit() : advance());
  }

  function refreshCount() {
    const p = $('.progress', main);
    if (p) p.outerHTML = progress();
  }

  function advance() {
    if (s.step === 0) {
      const err = $('#err', main);
      if (!s.name.trim()) { err.textContent = 'צריך למלא שם מלא כדי להמשיך'; $('[data-k="name"]', main).focus(); return; }
      if (!s.englishName.trim() || !/[a-z]/i.test(s.englishName)) { err.textContent = 'צריך למלא שם באותיות באנגלית כדי להמשיך'; $('[data-k="englishName"]', main).focus(); return; }
    }
    setStep(s.step + 1);
  }

  let tsToken = '';
  function mountTurnstile() {
    const go = () => window.turnstile?.render('#ts', { sitekey: cfg.turnstileSiteKey, language: 'he', callback: (t) => { tsToken = t; } });
    if (window.turnstile) return go();
    const sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; sc.async = true; sc.onload = go;
    document.head.append(sc);
  }

  async function submit() {
    const btn = $('#next', main);
    busy(btn, true, 'שולח...');
    $('#err', main).textContent = '';
    try {
      await api('/public/candidates', { body: { name: s.name, englishName: s.englishName, role: s.role, company: s.company, email: s.email, answers: s.answers, website: $('#website')?.value || '', turnstile: tsToken } });
      try { localStorage.removeItem(STORE); } catch { /* ignore */ }
      main.innerHTML = `<div style="padding-top:12px"><div class="done-mark">${icon('check')}</div>
        <h2>תודה רבה, ${esc(s.name.split(' ')[0])}!</h2>
        <p class="lead">התשובות התקבלו. צוות התוכנית יבנה מהן פרופיל כתיבה אישי, וכל פוסט שייכתב בשמך יישלח אליך לאישור לפני פרסום. אפשר לסגור את החלון.</p></div>`;
      window.scrollTo(0, 0);
    } catch (e) { $('#err', main).textContent = e.message; busy(btn, false); }
  }

  draw();
}, { public: true });

// ---------- ambassador review ----------
const X_LIMIT = 280;
const NETS = [
  { id: 'linkedin', label: 'לינקדאין', ic: 'linkedin', url: (t) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(t)}`, prefills: true },
  { id: 'x', label: 'X', ic: 'twitter', url: (t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}`, prefills: true },
  { id: 'facebook', label: 'פייסבוק', ic: 'facebook', url: () => 'https://www.facebook.com/', prefills: false },
  { id: 'instagram', label: 'אינסטגרם', ic: 'instagram', url: () => 'https://www.instagram.com/', prefills: false },
];

on('/review/([a-f0-9]{32})', async (root, token) => {
  document.title = 'פוסט לאישור · שגרירי כללית';
  root.innerHTML = frame(['פוסט', 'לאישור שלך'], '', '<div class="loading"><span class="spin"></span> טוען...</div>', true);
  const main = $('#pubmain');
  let data;
  try { data = await api(`/public/review/${token}`); }
  catch (e) { data = e.data || { state: 'invalid' }; if (!e.data) { main.innerHTML = `<div class="err">${esc(e.message)}</div>`; return; } }

  if (data.state === 'invalid') {
    main.innerHTML = `<h2>הקישור הזה לא פעיל</h2><p class="lead">ייתכן שהוא הועתק חלקית, או שהפוסט הוסר. אפשר לבקש קישור חדש ממי ששלח/ה אותו.</p>`;
    return;
  }
  if (data.state === 'expired') {
    main.innerHTML = `<h2>תוקף הקישור פג</h2><p class="lead">קישורי אישור פעילים 14 יום. אפשר לבקש קישור חדש ממי ששלח/ה אותו, והפוסט יחכה לך שם.</p>`;
    return;
  }
  if (data.state === 'approved') return approved(main, token, data);

  main.innerHTML = `<h2>${esc(data.personaName ? `${data.personaName}, זה פוסט שנכתב בשמך` : 'פוסט שנכתב בשמך')}</h2>
    <p class="lead">הוא עדיין לא פורסם. אפשר לאשר אותו כמו שהוא, או לערוך כאן ואז לאשר. אחרי האישור יופיעו כאן כפתורי העתקה ופרסום, ואפשר יהיה לחזור לקישור בכל שלב.</p>
    ${data.topic || data.platform ? `<div class="note" style="margin-top:20px">${icon('info')}<div>${data.topic ? `<b>נושא:</b> ${esc(data.topic)}` : ''}${data.topic && data.platform ? '<br>' : ''}${data.platform ? `<b>מיועד ל:</b> ${esc(data.platform)}` : ''}</div></div>` : ''}
    <label class="field reviewtext"><span>הטקסט (אפשר לערוך)</span><textarea class="textarea" id="txt">${esc(data.body)}</textarea></label>
    <p class="small" id="changed" style="color:var(--teal);margin-top:8px;display:none">ערכת את הטקסט. האישור יישמר עם השינויים שלך, וזה גם יעזור לנו לכתוב מדויק יותר בפעם הבאה.</p>
    <div class="err" id="err" role="alert"></div>
    <div class="btns" style="margin-top:24px"><button type="button" class="btn go wide" id="ok">${icon('check')}<span>אישור הפוסט</span></button></div>
    <p class="xs muted" style="margin-top:12px">לא מתאים לך? אפשר פשוט לא לאשר, ולכתוב למי ששלח/ה לך את הקישור.</p>`;
  const txt = $('#txt'), btn = $('#ok');
  txt.oninput = () => {
    const ch = txt.value.trim() !== data.body.trim();
    $('#changed').style.display = ch ? 'block' : 'none';
    btn.querySelector('span').textContent = ch ? 'אישור עם השינויים' : 'אישור הפוסט';
    btn.disabled = !txt.value.trim();
  };
  btn.onclick = async () => {
    busy(btn, true, 'שומר...');
    $('#err').textContent = '';
    try {
      const r = await api(`/public/review/${token}`, { body: { content: txt.value } });
      approved(main, token, { ...data, body: r.body, edited: r.edited, justApproved: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { $('#err').textContent = e.message; busy(btn, false); }
  };
}, { public: true });

function approved(main, token, data) {
  main.innerHTML = `<div class="done-mark">${icon('check')}</div>
    <h2>${data.justApproved ? 'תודה, הפוסט אושר' : 'הפוסט הזה כבר אושר'}</h2>
    <p class="lead">${data.edited ? 'השינויים שלך נשמרו. ' : ''}זה הנוסח הסופי, מוכן לפרסום. אפשר לחזור לקישור הזה בכל שלב ולהעתיק שוב.</p>
    <div class="final" id="final">${esc(data.body)}</div>
    <div class="btns" style="margin-top:14px"><button type="button" class="btn wide" id="copy">${icon('copy')}<span>העתקת הטקסט</span></button></div>
    <h3 style="margin-top:32px;font-size:19px;color:var(--deep)">פרסום ברשת</h3>
    <p class="small muted" style="margin-top:4px">כל כפתור מעתיק את הטקסט ופותח את הרשת בלשונית חדשה. בפייסבוק ובאינסטגרם צריך להדביק.</p>
    <div class="nets">${NETS.map((n) => `<button type="button" class="btn ghost" data-net="${n.id}">${icon(n.ic)}<span>${n.label}${n.prefills ? '' : ' (הדבקה)'}</span></button>`).join('')}</div>
    ${data.body.length > X_LIMIT ? `<p class="xs" style="color:var(--warn);margin-top:8px">הפוסט ארוך מ-${X_LIMIT} תווים, וב-X יהיה צריך לקצר אותו.</p>` : ''}
    <div class="card" style="margin-top:32px"><header><h3>פרסמת? אפשר להדביק כאן את הקישור לפוסט</h3><p>כך נדע מה עלה, ולא נשאל אותך שוב.</p></header>
      <div class="body">${data.publishedUrl ? `<div class="note ok">${icon('circle-check')}<div>תודה, הקישור נשמר.</div></div>` : `<label class="field" style="margin-top:0"><span class="sr">קישור לפוסט</span><input class="input" id="purl" dir="ltr" placeholder="https://www.linkedin.com/posts/..." inputmode="url"></label>
        <div class="err" id="perr" role="alert"></div>
        <div class="btns" style="margin-top:14px"><button type="button" class="btn ghost" id="psave">שמירת הקישור</button></div>`}</div></div>`;
  $('#copy').onclick = async () => { if (await copyText(data.body)) toast('הטקסט הועתק'); };
  $$('[data-net]').forEach((b) => {
    b.onclick = async () => {
      const n = NETS.find((x) => x.id === b.dataset.net);
      await copyText(data.body);
      window.open(n.url(data.body), '_blank', 'noopener,noreferrer');
      toast(n.prefills ? 'הטקסט הועתק ונפתח חלון כתיבה' : 'הטקסט הועתק. אפשר להדביק בחלון שנפתח');
    };
  });
  $('#psave')?.addEventListener('click', async (e) => {
    busy(e.currentTarget, true, 'שומר...');
    try { await api(`/public/review/${token}/published`, { body: { url: $('#purl').value } }); approved(main, token, { ...data, justApproved: false, publishedUrl: $('#purl').value }); toast('הקישור נשמר'); }
    catch (err) { $('#perr').textContent = err.message; busy(e.currentTarget, false); }
  });
}
