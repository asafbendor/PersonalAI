// The pages people outside the team see: the candidate questionnaire, the ambassador's review
// page, and the personal story link. No navigation, nothing that hints an admin area exists.
// Hebrew, Arabic and Russian; Arabic and Russian still need a native speaker's review.
import { $, $$, esc, icon, stripe, api, on, copyText, busy, toast, modal } from '/core.js';
import { TOTAL_QUESTIONS } from '/questionnaire.js';
import { LANGS, t, sectionsFor, speechLang } from '/i18n.js';

const STORE = 'ambassador-questionnaire-v1';

function setLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = LANGS[lang]?.dir || 'rtl';
  document.body.classList.toggle('lang-ar', lang === 'ar');
  document.body.classList.toggle('lang-ru', lang === 'ru');
}

function frame(L, title, sub, inner, { short = false, switcher = '' } = {}) {
  return `<div class="pub">
    <header class="brandhead"><div class="wrap"><div class="brandrow"><img class="logo" src="/img/clalit-logo-white.svg" alt="כללית">${switcher}</div>
      <h1>${title.map((x) => `<span>${esc(x)}</span>`).join('')}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></header>
    ${stripe()}
    <main class="${short ? 'short' : ''}"><div class="wrap" id="pubmain">${inner}</div></main>
    <footer class="wrap foot-legal">${esc(L.foot)}</footer>
  </div>`;
}

const switcherHtml = (cur) => `<div class="langs" role="group" aria-label="שפה / اللغة / Язык">${Object.entries(LANGS).map(([k, v]) => `<button type="button" class="${k === cur ? 'on' : ''}" aria-pressed="${k === cur}" data-lang="${k}" lang="${k}">${v.name}</button>`).join('')}</div>`;

// ---------- questionnaire ----------
on('/onboarding', (root) => {
  const blank = { step: 0, lang: 'he', name: '', englishName: '', role: '', company: '', email: '', answers: {}, choices: {}, details: {} };
  let s = { ...blank, answers: {}, choices: {}, details: {} }, restored = false;
  try { const saved = JSON.parse(localStorage.getItem(STORE) || 'null'); if (saved && typeof saved === 'object') { s = { ...blank, ...saved }; restored = true; } } catch { /* private mode: works, without autosave */ }
  const urlLang = new URLSearchParams(location.search).get('lang');
  if (!restored && LANGS[urlLang]) s.lang = urlLang;
  let cfg = { turnstileSiteKey: null, contact: {} };
  let SECTIONS = sectionsFor(s.lang), L = t(s.lang);

  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* ignore */ } };
  const answered = () => Object.values(s.answers).filter((a) => a && a.trim()).length;
  const compose = (sel, detail) => { const h = sel.join(', '), x = (detail || '').trim(); return h && x ? `${h}\n\n${x}` : h || x; };
  const showDetail = (q) => { const sel = s.choices[q.id] || []; if (!q.detailPrompt || !sel.length) return false; return !q.detailWhen || sel.some((x) => q.detailWhen.includes(x)); };
  const last = () => SECTIONS.length + 1;

  function mount() {
    setLang(s.lang);
    document.title = `${L.qTitle.join(' ')} · כללית`;
    root.innerHTML = frame(L, L.qTitle, L.qSub, '', { switcher: switcherHtml(s.lang) });
    $$('[data-lang]', root).forEach((b) => {
      b.onclick = () => {
        if (b.dataset.lang === s.lang) return;
        // Answers already typed stay; choice answers are kept as written in the language they were picked in.
        s.lang = b.dataset.lang; save(); SECTIONS = sectionsFor(s.lang); L = t(s.lang); mount();
      };
    });
    draw();
  }
  const main = () => $('#pubmain');

  function progress() {
    const inSection = s.step >= 1 && s.step <= SECTIONS.length;
    const pct = Math.round((answered() / TOTAL_QUESTIONS) * 100);
    const label = s.step === 0 ? L.before : inSection ? L.part(L.letters[s.step - 1], L.letters[SECTIONS.length - 1]) : L.review;
    return `<div class="progress"><div class="row"><b>${esc(label)}</b><span>${esc(L.answered(answered(), TOTAL_QUESTIONS))}</span></div><div class="track" aria-hidden="true"><i style="width:${pct}%"></i></div></div>`;
  }

  function bottom() {
    const end = s.step === last();
    const nextLabel = s.step < SECTIONS.length ? L.next(L.letters[s.step]) : s.step === SECTIONS.length ? L.toReview : L.send;
    return `<div class="bottombar"><div class="wrap">
      ${s.step > 0 ? `<button type="button" class="btn ghost" id="back">${icon('chevron-right', 'dirflip')}<span>${esc(L.back)}</span></button>` : ''}
      <div class="grow"><span class="saved">${icon('circle-check', 'sm')}${esc(L.saved)}</span></div>
      <button type="button" class="btn next ${end ? 'go' : ''}" id="next"><span>${esc(nextLabel)}</span>${end ? icon('send') : icon('chevron-left', 'dirflip')}</button>
    </div></div>`;
  }

  function contactBlock() {
    const c = cfg.contact || {};
    const lines = [c.name && `<b>${esc(c.name)}</b>${c.role ? `, ${esc(c.role)}` : ''}`, c.email && `<a class="link" href="mailto:${esc(c.email)}" dir="ltr">${esc(c.email)}</a>`, c.phone && `<a class="link" href="tel:${esc(c.phone)}" dir="ltr">${esc(c.phone)}</a>`].filter(Boolean);
    return `<div class="note" style="margin-top:16px">${icon('users')}<div><b>${esc(L.whoT)}</b><div class="small" style="margin-top:4px">${esc(L.whoDefault)}${lines.length ? `<br>${esc(L.whoContact)} ${lines.join(' · ')}` : ''}</div></div></div>`;
  }

  function intro() {
    return `${restored && (s.name || answered()) ? `<div class="note ok" style="margin-bottom:24px">${icon('circle-check')}<div><b>${esc(L.resumed)}</b> ${esc(L.resumedText)} <button type="button" class="link" id="restart">${esc(L.restart)}</button></div></div>` : ''}
      <h2>${esc(L.before)}</h2>
      <p class="lead">${esc(L.intro)}</p>
      <div class="note" style="margin-top:20px">${icon('shield-check')}<div><b>${esc(L.safe)}</b> ${esc(L.safeText)}</div></div>
      ${contactBlock()}
      <label class="field"><span>${esc(L.name)}</span><input class="input" data-k="name" value="${esc(s.name)}" autocomplete="name" placeholder="${esc(L.namePh)}"></label>
      <label class="field"><span>${esc(L.en)}</span><input class="input" data-k="englishName" value="${esc(s.englishName)}" dir="ltr" autocomplete="off" placeholder="Dana Cohen"><span class="hint">${esc(L.enHint)}</span></label>
      <label class="field"><span>${esc(L.role)}</span><input class="input" data-k="role" value="${esc(s.role)}" placeholder="${esc(L.rolePh)}"></label>
      <label class="field"><span>${esc(L.org)}</span><input class="input" data-k="company" value="${esc(s.company)}" placeholder="${esc(L.orgPh)}"></label>
      <label class="field"><span>${esc(L.email)}</span><input class="input" type="email" data-k="email" value="${esc(s.email)}" dir="ltr" autocomplete="email" placeholder="name@example.com"><span class="hint">${esc(L.emailHint)}</span></label>
      <label class="hp" aria-hidden="true">website<input tabindex="-1" autocomplete="off" id="website"></label>
      <details class="note" style="margin-top:28px;display:block">
        <summary style="cursor:pointer;font-weight:600;min-height:32px">${esc(L.privacyT)}</summary>
        <div class="small" style="margin-top:10px;display:grid;gap:8px">${L.privacy.map((x) => `<p>${esc(x)}</p>`).join('')}</div>
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
      ${q.kind === 'multi' ? `<p class="xs muted" style="margin-top:8px">${esc(L.multi)}</p>` : ''}
      ${showDetail(q) ? `<label class="detail"><span>${esc(q.detailPrompt)}</span><textarea class="textarea" data-detail="${q.id}" rows="3">${esc(s.details[q.id] || '')}</textarea></label>` : ''}
    </div>`;
  }

  function section(idx) {
    const sec = SECTIONS[idx];
    return `<h2>${esc(sec.title)}</h2><p class="lead">${esc(sec.description)}</p>
      <div style="margin-top:8px">${sec.questions.map(question).join('')}</div>
      ${idx === SECTIONS.length - 1 ? `<div class="note" style="margin-top:8px">${icon('shield-check')}<div>${esc(L.safe)}</div></div>` : ''}`;
  }

  function review() {
    const missing = TOTAL_QUESTIONS - answered();
    return `<h2>${esc(L.review)}</h2>
      <p class="lead">${esc(L.reviewLead(answered(), TOTAL_QUESTIONS, missing))}</p>
      <div class="card" style="margin-top:20px"><div class="rows">${SECTIONS.map((sec, i) => {
        const done = sec.questions.filter((q) => (s.answers[q.id] || '').trim()).length;
        return `<button type="button" class="go" data-jump="${i + 1}" style="width:100%;border:0;background:none;text-align:start;cursor:pointer;font:inherit">
          <div class="grow"><div class="t">${esc(L.partOf(L.letters[i], sec.title))}</div><div class="d">${esc(L.qCount(done, sec.questions.length))}</div></div>
          <span class="end">${done === sec.questions.length ? `<span class="chip ok">${esc(L.done)}</span>` : `<span class="chip warn">${esc(L.canFill)}</span>`}${icon('chevron-left', 'sm dirflip')}</span></button>`;
      }).join('')}</div></div>
      <div class="note" style="margin-top:20px">${icon('shield-check')}<div><b>${esc(L.after)}</b> ${esc(L.afterText)}</div></div>
      <div id="ts" style="margin-top:20px"></div>
      <div class="err" id="err" role="alert"></div>`;
  }

  function draw() {
    const body = s.step === 0 ? intro() : s.step <= SECTIONS.length ? section(s.step - 1) : review();
    main().innerHTML = progress() + body + bottom();
    bind();
    if (s.step === last() && cfg.turnstileSiteKey) mountTurnstile();
  }

  function setStep(n) { s.step = Math.max(0, Math.min(last(), n)); save(); draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function bind() {
    const m = main();
    $$('[data-k]', m).forEach((el) => { el.oninput = () => { s[el.dataset.k] = el.value; save(); }; });
    $$('[data-q]', m).forEach((el) => { el.oninput = () => { s.answers[el.dataset.q] = el.value; save(); refreshCount(); }; });
    $$('[data-detail]', m).forEach((el) => {
      el.oninput = () => { const id = el.dataset.detail; s.details[id] = el.value; s.answers[id] = compose(s.choices[id] || [], el.value); save(); };
    });
    $$('[data-opt]', m).forEach((el) => {
      el.onclick = () => {
        const id = el.dataset.opt, v = el.dataset.v;
        const q = SECTIONS.flatMap((x) => x.questions).find((x) => x.id === id);
        const cur = (s.choices[id] || []).filter((x) => q.options.includes(x));
        const next = q.kind === 'multi' ? (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) : (cur.includes(v) ? [] : [v]);
        s.choices[id] = next;
        if (!(next.length && (!q.detailWhen || next.some((x) => q.detailWhen.includes(x))))) s.details[id] = '';
        s.answers[id] = compose(next, s.details[id]);
        save();
        const y = window.scrollY; draw(); window.scrollTo(0, y);
        $(`[data-opt="${id}"][data-v="${CSS.escape(v)}"]`, main())?.focus();
      };
    });
    $$('[data-jump]', m).forEach((el) => { el.onclick = () => setStep(Number(el.dataset.jump)); });
    $('#restart', m)?.addEventListener('click', () => { const lang = s.lang; s = { ...blank, lang, answers: {}, choices: {}, details: {} }; restored = false; try { localStorage.removeItem(STORE); } catch { /* ignore */ } draw(); });
    $('#back', m)?.addEventListener('click', () => setStep(s.step - 1));
    $('#next', m).onclick = () => (s.step === last() ? submit() : advance());
  }

  function refreshCount() { const p = $('.progress', main()); if (p) p.outerHTML = progress(); }

  function advance() {
    if (s.step === 0) {
      const err = $('#err', main());
      if (!s.name.trim()) { err.textContent = L.errName; $('[data-k="name"]', main()).focus(); return; }
      if (!s.englishName.trim() || !/[a-z]/i.test(s.englishName)) { err.textContent = L.errEn; $('[data-k="englishName"]', main()).focus(); return; }
    }
    setStep(s.step + 1);
  }

  let tsToken = '';
  function mountTurnstile() {
    const go = () => window.turnstile?.render('#ts', { sitekey: cfg.turnstileSiteKey, language: s.lang, callback: (x) => { tsToken = x; } });
    if (window.turnstile) return go();
    const sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; sc.async = true; sc.onload = go;
    document.head.append(sc);
  }

  async function submit() {
    const btn = $('#next', main());
    busy(btn, true, L.sending);
    $('#err', main()).textContent = '';
    try {
      await api('/public/candidates', { body: { name: s.name, englishName: s.englishName, role: s.role, company: s.company, email: s.email, answers: s.answers, language: s.lang, website: $('#website')?.value || '', turnstile: tsToken } });
      try { localStorage.removeItem(STORE); } catch { /* ignore */ }
      main().innerHTML = `<div style="padding-top:12px"><div class="done-mark">${icon('check')}</div><h2>${esc(L.thanks(s.name.split(' ')[0]))}</h2><p class="lead">${esc(L.thanksText)}</p></div>`;
      window.scrollTo(0, 0);
    } catch (e) { $('#err', main()).textContent = e.message; busy(btn, false); }
  }

  api('/public/config').then((c) => { cfg = c; if (s.step === 0) draw(); }).catch(() => {});
  mount();
}, { public: true });

// ---------- ambassador review ----------
const X_LIMIT = 280;
const NETS = [
  { id: 'linkedin', label: 'LinkedIn', ic: 'linkedin', url: (x) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(x)}`, prefills: true },
  { id: 'x', label: 'X', ic: 'twitter', url: (x) => `https://x.com/intent/post?text=${encodeURIComponent(x)}`, prefills: true },
  { id: 'facebook', label: 'Facebook', ic: 'facebook', url: () => 'https://www.facebook.com/', prefills: false },
  { id: 'instagram', label: 'Instagram', ic: 'instagram', url: () => 'https://www.instagram.com/', prefills: false },
];

on('/review/([a-f0-9]{32})', async (root, token) => {
  let data;
  try { data = await api(`/public/review/${token}`); }
  catch (e) { data = e.data || { state: 'invalid' }; }
  const lang = LANGS[data.language] ? data.language : 'he';
  const L = t(lang);
  setLang(lang);
  document.title = `${L.rTitle.join(' ')} · כללית`;
  root.innerHTML = frame(L, L.rTitle, '', '', { short: true });
  const main = $('#pubmain');

  if (data.state === 'invalid') { main.innerHTML = `<h2>${esc(L.invalidT)}</h2><p class="lead">${esc(L.invalid)}</p>`; return; }
  if (data.state === 'expired') { main.innerHTML = `<h2>${esc(L.expiredT)}</h2><p class="lead">${esc(L.expired)}</p>`; return; }
  if (data.state === 'approved') return approved(main, token, data, L);

  main.innerHTML = `<h2>${esc(L.hello(data.personaName))}</h2>
    <p class="lead">${esc(L.rLead)}</p>
    ${data.topic || data.platform ? `<div class="note" style="margin-top:20px">${icon('info')}<div>${data.topic ? `<b>${esc(L.topic)}</b> ${esc(data.topic)}` : ''}${data.topic && data.platform ? '<br>' : ''}${data.platform ? `<b>${esc(L.forNet)}</b> ${esc(data.platform)}` : ''}</div></div>` : ''}
    ${data.confirm?.length ? `<div class="note warn" style="margin-top:16px">${icon('circle-alert')}<div><b>${esc(L.confirmT)}</b><div class="small" style="margin-top:4px">${esc(L.confirm)}</div><ul class="confirm">${data.confirm.map((c) => `<li>"${esc(c)}"</li>`).join('')}</ul></div></div>` : ''}
    ${data.versions?.length > 1 ? `<div class="field" style="margin-top:24px"><span>${esc(L.versionsT)}</span><p class="small muted" style="margin-bottom:4px">${esc(L.versionsHint)}</p><div class="toggles" id="vers">${data.versions.map((v, i) => `<button type="button" class="toggle ${i === 0 ? 'on' : ''}" aria-pressed="${i === 0}" data-ver="${i}">${esc(L.version)} ${i + 1}</button>`).join('')}</div></div>` : ''}
    <label class="field reviewtext"><span>${esc(L.text)}</span><textarea class="textarea" id="txt">${esc(data.body)}</textarea></label>
    <p class="small" id="changed" style="color:var(--teal);margin-top:8px;display:none">${esc(L.changed)}</p>
    ${data.hasImage ? `<div class="card" style="margin-top:20px"><header><h3>${esc(L.imageT)}</h3></header><div class="body"><img class="postimg" src="/api/public/review/${token}/image" alt=""></div></div>` : ''}
    <div class="err" id="err" role="alert"></div>
    <div class="btns" style="margin-top:24px"><button type="button" class="btn go wide" id="ok">${icon('check')}<span>${esc(L.approve)}</span></button></div>
    <p class="xs muted" style="margin-top:12px">${esc(L.notForMe)}</p>`;
  const txt = $('#txt'), btn = $('#ok');
  let ver = 0;
  const base = () => (data.versions?.[ver] ?? data.body);
  $$('[data-ver]').forEach((b) => {
    b.onclick = async () => {
      const n = Number(b.dataset.ver);
      if (n === ver) return;
      if (txt.value.trim() !== base().trim() && !(await modal({ title: L.versionLose, narrow: true, body: '', actions: [{ label: L.back, cls: 'ghost', value: false }, { label: `${L.version} ${n + 1}`, value: true }] }))) return;
      ver = n; txt.value = base();
      $$('[data-ver]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      txt.oninput();
    };
  });
  txt.oninput = () => {
    const ch = txt.value.trim() !== base().trim();
    $('#changed').style.display = ch ? 'block' : 'none';
    btn.querySelector('span').textContent = ch ? L.approveEdit : L.approve;
    btn.disabled = !txt.value.trim();
  };
  btn.onclick = async () => {
    busy(btn, true, L.saving);
    $('#err').textContent = '';
    try {
      const r = await api(`/public/review/${token}`, { body: { content: txt.value, version: ver } });
      approved(main, token, { ...data, body: r.body, edited: r.edited, justApproved: true }, L);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { $('#err').textContent = e.message; busy(btn, false); }
  };
}, { public: true });

function approved(main, token, data, L) {
  const track = data.trackPath ? `${location.origin}${data.trackPath}` : '';
  main.innerHTML = `<div class="done-mark">${icon('check')}</div>
    <h2>${esc(data.justApproved ? L.approvedNow : L.approvedBefore)}</h2>
    <p class="lead">${data.edited ? esc(L.editedSaved) : ''}${esc(L.finalText)}</p>
    <div class="final">${esc(data.body)}</div>
    <div class="btns" style="margin-top:14px"><button type="button" class="btn wide" id="copy">${icon('copy')}<span>${esc(L.copy)}</span></button></div>
    ${data.hasImage ? `<div class="card" style="margin-top:24px"><header><h3>${esc(L.imageT)}</h3><p>${esc(L.imageHint)}</p></header><div class="body"><img class="postimg" src="/api/public/review/${token}/image" alt=""><div class="btns" style="margin-top:12px"><a class="btn ghost" href="/api/public/review/${token}/image" download>${icon('download')}<span>${esc(L.download)}</span></a></div></div></div>` : ''}
    <h3 style="margin-top:32px;font-size:19px;color:var(--deep)">${esc(L.publishT)}</h3>
    <p class="small muted" style="margin-top:4px">${esc(L.publishHint)}</p>
    <div class="nets">${NETS.map((n) => `<button type="button" class="btn ghost" data-net="${n.id}">${icon(n.ic)}<span>${n.label}${n.prefills ? '' : esc(L.paste)}</span></button>`).join('')}</div>
    ${data.body.length > X_LIMIT ? `<p class="xs" style="color:var(--warn);margin-top:8px">${esc(L.xLong(X_LIMIT))}</p>` : ''}
    ${track ? `<div class="card" style="margin-top:24px"><header><h3>${esc(L.linkT)}</h3><p>${esc(L.linkHint)}</p></header><div class="body"><div class="linkbox"><code>${esc(track)}</code><button type="button" class="btn sm ghost" id="cplink">${esc(L.copyLink)}</button></div></div></div>` : ''}
    <div class="card" style="margin-top:24px"><header><h3>${esc(L.pubT)}</h3><p>${esc(L.pubHint)}</p></header>
      <div class="body">${data.publishedUrl ? `<div class="note ok">${icon('circle-check')}<div>${esc(L.pubSaved)}</div></div>` : `<label class="field" style="margin-top:0"><span class="sr">URL</span><input class="input" id="purl" dir="ltr" placeholder="https://www.linkedin.com/posts/..." inputmode="url"></label>
        <div class="err" id="perr" role="alert"></div>
        <div class="btns" style="margin-top:14px"><button type="button" class="btn ghost" id="psave">${esc(L.saveLink)}</button></div>`}</div></div>
    ${data.publishedUrl ? `<div class="card" style="margin-top:24px"><header><h3>${esc(L.howT)}</h3><p>${esc(L.howHint)}</p></header><div class="body">
      <div class="grid g2" style="gap:0 16px"><label class="field" style="margin-top:0"><span>${esc(L.reactions)}</span><input class="input" id="rx" type="number" min="0" inputmode="numeric" value="${data.reactions ?? ''}"></label>
      <label class="field" style="margin-top:0"><span>${esc(L.comments)}</span><input class="input" id="cm" type="number" min="0" inputmode="numeric" value="${data.comments ?? ''}"></label></div>
      <label class="field"><span>${esc(L.impressions)}</span><input class="input" id="im" type="number" min="0" inputmode="numeric" value="${data.impressions ?? ''}"><span class="hint">${esc(L.impressionsHint)}</span></label>
      <div class="btns" style="margin-top:14px"><button type="button" class="btn ghost" id="nsave">${esc(L.saveNums)}</button></div></div></div>` : ''}`;
  $('#copy').onclick = async () => { if (await copyText(data.body)) toast(L.copied); };
  $('#cplink')?.addEventListener('click', async () => { if (await copyText(track)) toast(L.linkCopied); });
  $$('[data-net]').forEach((b) => {
    b.onclick = async () => {
      const n = NETS.find((x) => x.id === b.dataset.net);
      await copyText(data.body);
      window.open(n.url(data.body), '_blank', 'noopener,noreferrer');
      toast(n.prefills ? L.opened : L.openedPaste);
    };
  });
  $('#psave')?.addEventListener('click', async (e) => {
    busy(e.currentTarget, true, L.saving);
    try { await api(`/public/review/${token}/published`, { body: { url: $('#purl').value } }); approved(main, token, { ...data, justApproved: false, publishedUrl: $('#purl').value }, L); }
    catch (err) { $('#perr').textContent = err.message; busy(e.currentTarget, false); }
  });
  $('#nsave')?.addEventListener('click', async (e) => {
    busy(e.currentTarget, true, L.saving);
    try { await api(`/public/review/${token}/published`, { body: { reactions: $('#rx').value, comments: $('#cm').value, impressions: $('#im').value } }); toast(L.numsSaved); } catch (err) { toast(err.message, 'circle-alert'); }
    busy(e.currentTarget, false);
  });
}

// ---------- personal story link ----------
on('/story/([a-f0-9]{32})', async (root, token) => {
  let info;
  try { info = await api(`/public/story/${token}`); } catch { info = null; }
  const lang = LANGS[info?.language] ? info.language : 'he';
  const L = t(lang);
  setLang(lang);
  document.title = `${L.sTitle.join(' ')} · כללית`;
  root.innerHTML = frame(L, L.sTitle, '', '', { short: true });
  const main = $('#pubmain');
  if (!info) { main.innerHTML = `<h2>${esc(L.invalidT)}</h2><p class="lead">${esc(L.invalid)}</p>`; return; }
  const form = () => {
    main.innerHTML = `<h2>${esc(L.sHello(info.name.split(' ')[0]))}</h2><p class="lead">${esc(L.sLead)}</p>
      <div class="note warn" style="margin-top:20px">${icon('shield-check')}<div>${esc(L.sPrivacy)}</div></div>
      <label class="field"><span>${esc(L.sField)}</span><textarea class="textarea" id="st" rows="8" placeholder="${esc(L.sPh)}"></textarea></label>
      <label class="hp" aria-hidden="true">website<input tabindex="-1" autocomplete="off" id="website"></label>
      <div class="btns" style="margin-top:14px"><button type="button" class="btn ghost" id="mic">${icon('megaphone')}<span>${esc(L.dictate)}</span></button><span class="small muted" id="micst" role="status"></span></div>
      <div class="err" id="err" role="alert"></div>
      <div class="btns" style="margin-top:24px"><button type="button" class="btn go wide" id="send">${icon('send')}<span>${esc(L.sSend)}</span></button></div>`;
    // Dictation happens in the browser; no audio is recorded or stored.
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mic = $('#mic'), st = $('#st');
    if (!SR) { mic.disabled = true; $('#micst').textContent = L.noDictate; }
    let rec = null;
    mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = speechLang(lang); rec.continuous = true; rec.interimResults = false;
      const startText = st.value;
      let finalText = '';
      rec.onresult = (ev) => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) finalText += `${ev.results[i][0].transcript} `; st.value = `${startText}${startText && finalText ? ' ' : ''}${finalText}`.trim(); };
      rec.onend = () => { rec = null; mic.querySelector('span').textContent = L.dictate; $('#micst').textContent = ''; };
      rec.onerror = () => { rec = null; };
      rec.start(); mic.querySelector('span').textContent = L.stop; $('#micst').textContent = L.listening;
    };
    $('#send').onclick = async (e) => {
      busy(e.currentTarget, true, L.sending);
      $('#err').textContent = '';
      try {
        await api(`/public/story/${token}`, { body: { text: st.value, website: $('#website').value } });
        main.innerHTML = `<div class="done-mark">${icon('check')}</div><h2>${esc(L.sThanks)}</h2><p class="lead">${esc(L.sThanksText)}</p><div class="btns" style="margin-top:20px"><button type="button" class="btn ghost" id="again">${esc(L.another)}</button></div>`;
        $('#again').onclick = form;
      } catch (err) { $('#err').textContent = err.message; busy(e.currentTarget, false); }
    };
  };
  form();
}, { public: true });
