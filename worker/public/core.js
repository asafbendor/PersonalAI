import { ICONS } from '/icons.js';

// ---------- helpers shared by every view ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const icon = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
export const stripe = (cls = '') => `<div class="stripe ${cls}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>`;

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
// Day names in full, never a single letter.
export function fmtDate(iso, withDay = true) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  const dm = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  return withDay ? `יום ${DAYS[d.getDay()]} ${dm}` : dm;
}
export function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דקות`;
  if (mins < 60 * 24) return `לפני ${Math.round(mins / 60)} שעות`;
  return `${fmtDate(iso)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function api(path, opts = {}) {
  const init = { credentials: 'same-origin', method: opts.method || (opts.body ? 'POST' : 'GET') };
  if (opts.form) init.body = opts.form;
  else if (opts.body) { init.body = JSON.stringify(opts.body); init.headers = { 'content-type': 'application/json' }; }
  let res;
  try { res = await fetch('/api' + path, init); } catch { throw new Error('הבקשה לא הגיעה לשרת. אפשר לנסות שוב'); }
  if (res.status === 401 && !path.startsWith('/auth/') && !path.startsWith('/public/')) { go('/login?next=' + encodeURIComponent(location.pathname)); throw new Error('נדרשת התחברות'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'הפעולה לא הצליחה'); e.status = res.status; e.data = data; throw e; }
  return data;
}

export function toast(msg, ic = 'circle-check') {
  $$('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = icon(ic) + `<span>${esc(msg)}</span>`;
  document.body.append(el);
  setTimeout(() => el.remove(), 3600);
}

export function modal({ title, body, actions = [], narrow = false }) {
  return new Promise((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${narrow ? 'narrow' : ''}" role="dialog" aria-modal="true" aria-labelledby="mt">
      <header><h2 id="mt">${esc(title)}</h2><button type="button" data-x aria-label="סגירה">${icon('x')}</button></header>
      <div class="body">${body}</div>
      ${actions.length ? `<footer>${actions.map((a, i) => `<button type="button" class="btn ${a.cls || ''}" data-a="${i}">${esc(a.label)}</button>`).join('')}</footer>` : ''}
    </div>`;
    const close = (v) => { bg.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    bg.addEventListener('click', (e) => {
      if (e.target === bg || e.target.closest('[data-x]')) return close(null);
      const a = e.target.closest('[data-a]');
      if (a) {
        const act = actions[Number(a.dataset.a)];
        close(act.value !== undefined ? act.value : (act.collect ? act.collect(bg) : true));
      }
    });
    document.addEventListener('keydown', onKey);
    document.body.append(bg);
    ($('textarea, input', bg) || $('[data-a]', bg) || $('[data-x]', bg))?.focus();
  });
}

// A destructive action is confirmed in the app's own dialog, never the browser's.
export const confirmDanger = (title, text, label) =>
  modal({ title, body: `<p>${esc(text)}</p>`, narrow: true, actions: [{ label: 'ביטול', cls: 'ghost', value: false }, { label, cls: 'danger', value: true }] });

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok;
  }
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span> ${esc(label || 'רגע...')}`; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}

export const initials = (name) => esc(String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join(''));

// ---------- router ----------
const routes = [];
export function on(pattern, handler, opts = {}) { routes.push({ re: new RegExp(`^${pattern}$`), handler, ...opts }); }
export function go(path, replace = false) {
  if (replace) history.replaceState(null, '', path); else history.pushState(null, '', path);
  render();
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="/"]');
  if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || a.hasAttribute('download')) return;
  e.preventDefault();
  go(a.getAttribute('href'));
});
window.addEventListener('popstate', () => render());

const app = $('#app');
export const state = { authed: null, counts: {} };

async function checkAuth() {
  if (state.authed !== null) return state.authed;
  try { await api('/me'); state.authed = true; } catch { state.authed = false; }
  return state.authed;
}

const NAV = [
  { href: '/', label: 'לוח בקרה', ic: 'layout-dashboard', match: /^\/$/ },
  { href: '/personas', label: 'שגרירים', ic: 'users', match: /^\/personas/ },
  { href: '/generate', label: 'יצירת פוסט', ic: 'sparkles', match: /^\/generate/ },
  { href: '/calendar', label: 'לוח פרסומים', ic: 'calendar-days', match: /^\/calendar/ },
  { href: '/topics', label: 'לוח נושאים', ic: 'list-checks', match: /^\/topics/ },
  { href: '/candidates', label: 'מועמדים', ic: 'user-plus', match: /^\/candidates/, badge: 'newCandidates' },
  { href: '/activity', label: 'מה קרה לאחרונה', ic: 'activity', match: /^\/activity/ },
  { href: '/backup', label: 'גיבוי', ic: 'database', match: /^\/backup/ },
];

function shell(inner) {
  const path = location.pathname;
  app.innerHTML = `<div class="shell">
    <aside class="side" id="side" aria-label="תפריט">
      <div class="brand"><img src="/img/clalit-logo-white.svg" alt="כללית"><div>שגרירי כללית<small>ניהול שגרירים ופוסטים</small></div></div>
      <nav class="nav">${NAV.map((n) => `<a href="${n.href}" class="${n.match.test(path) ? 'on' : ''}">${icon(n.ic)}<span>${n.label}</span>${n.badge && state.counts[n.badge] ? `<span class="badge">${state.counts[n.badge]}</span>` : ''}</a>`).join('')}</nav>
      <div class="foot">
        <a class="nav-out" href="/onboarding" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;min-height:44px;padding:0 8px;color:#c5dde1;font-size:14.5px">${icon('external-link')}<span>השאלון למועמדים</span></a>
        <button type="button" id="logout">${icon('log-out')}<span>יציאה</span></button>
      </div>
    </aside>
    <div class="main">
      <div class="topbar"><button type="button" id="menu" aria-label="פתיחת התפריט">${icon('menu')}</button><img src="/img/clalit-mark-white.svg" alt=""><b>שגרירי כללית</b></div>
      ${stripe('thin')}
      <div class="page" id="page">${inner}</div>
    </div>
  </div>
  <button type="button" class="totop" id="totop">${icon('arrow-up')}<span>למעלה</span></button>`;
  $('#logout').onclick = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); state.authed = false; go('/login'); };
  $('#menu').onclick = () => {
    $('#side').classList.add('open');
    const s = document.createElement('div'); s.className = 'scrim'; s.onclick = () => { $('#side').classList.remove('open'); s.remove(); }; document.body.append(s);
  };
  $('#totop').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  return $('#page');
}
window.addEventListener('scroll', () => $('#totop')?.classList.toggle('on', window.scrollY > 500), { passive: true });

export function setCounts(c) {
  Object.assign(state.counts, c);
  const a = $$('.nav a').find((x) => x.getAttribute('href') === '/candidates');
  if (a) { a.querySelector('.badge')?.remove(); if (state.counts.newCandidates) a.insertAdjacentHTML('beforeend', `<span class="badge">${state.counts.newCandidates}</span>`); }
}

export async function render() {
  const path = location.pathname;
  window.scrollTo(0, 0);
  $$('.scrim, .modal-bg').forEach((x) => x.remove());
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    if (r.public) { app.innerHTML = ''; return r.handler(app, ...m.slice(1)); }
    if (!(await checkAuth())) return go('/login?next=' + encodeURIComponent(path), true);
    const page = shell('<div class="loading"><span class="spin"></span> טוען...</div>');
    try { await r.handler(page, ...m.slice(1)); }
    catch (e) { if (e.message !== 'נדרשת התחברות') page.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    return;
  }
  if (!(await checkAuth())) return go('/login', true);
  shell('<div class="head"><div><h1>הדף לא נמצא</h1><p>אפשר לחזור ללוח הבקרה מהתפריט.</p></div></div>');
}

// ---------- login ----------
on('/login', (root) => {
  document.title = 'כניסה · שגרירי כללית';
  const next = new URLSearchParams(location.search).get('next') || '/';
  root.innerHTML = `<div class="login">
    <div class="login-side" aria-hidden="true">
      <div class="inner">
        <img class="logo" src="/img/clalit-logo-white.svg" alt="">
        <h2><span>הקול של</span><span>העובדים <em>שלנו</em>,</span><span>ברשתות.</span></h2>
        <div class="points">
          <div>${icon('sparkles')}<span>פוסטים שנכתבים בקול האישי של כל שגריר/ה</span></div>
          <div>${icon('shield-check')}<span>שום דבר לא מתפרסם בלי אישור של השגריר/ה</span></div>
          <div>${icon('calendar-days')}<span>לוח פרסומים ונושאים אחד לכל התוכנית</span></div>
        </div>
      </div>
      ${stripe()}
    </div>
    <div class="login-form">
      <div class="login-mob"><div class="brandhead" style="margin:-28px -16px 0"><img class="logo" src="/img/clalit-logo-white.svg" alt="כללית"><h1><span>שגרירי</span><span>כללית</span></h1></div>${stripe()}</div>
      <div class="login-body">
        <h1>כניסה לניהול התוכנית</h1>
        <p class="lead">המערכת מיועדת לצוות שמנהל את שגרירי כללית: שאלונים, פרופילים, פוסטים ואישורים.</p>
        <form id="f" novalidate>
          <label class="field"><span>סיסמה</span>
            <div class="pw"><input class="input" id="pw" type="password" autocomplete="current-password" required><button type="button" id="eye" aria-label="הצגת הסיסמה">${icon('eye')}</button></div>
          </label>
          <div class="err" id="err" role="alert"></div>
          <button class="btn" type="submit" id="go">כניסה</button>
        </form>
        <p class="lock">${icon('lock', 'sm')}<span>אחרי 5 ניסיונות שגויים הכניסה ננעלת ל-15 דקות.</span></p>
        <p class="lock">${icon('info', 'sm')}<span>שגרירים לא צריכים להיכנס כאן. הם מקבלים קישור אישי לכל פוסט.</span></p>
      </div>
    </div>
  </div>`;
  $('#eye').onclick = () => { const p = $('#pw'); const show = p.type === 'password'; p.type = show ? 'text' : 'password'; $('#eye').innerHTML = icon(show ? 'eye-off' : 'eye'); $('#eye').setAttribute('aria-label', show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'); };
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    $('#err').textContent = '';
    const btn = $('#go');
    busy(btn, true, 'בודק...');
    try {
      await api('/auth/login', { body: { password: $('#pw').value } });
      state.authed = true;
      go(next.startsWith('/') && !next.startsWith('//') ? next : '/', true);
    } catch (err) { $('#err').textContent = err.message; busy(btn, false); $('#pw').select(); }
  };
  $('#pw').focus();
}, { public: true });

