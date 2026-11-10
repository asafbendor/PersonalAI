// Image bank, weekly summary, monthly report, settings.
import { $, $$, esc, icon, api, on, go, toast, modal, confirmDanger, copyText, busy, fmtDate, MONTHS, localDay } from '/core.js';
import { waUrl } from '/admin.js';

function head(title, sub, actions = '') {
  document.title = `${title} · שגרירי כללית`;
  return `<div class="head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}
const pct = (v) => (v == null ? 'אין עדיין' : `${Math.round(v * 100)}%`);
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';

// ---------- image bank ----------
on('/images', async (page) => {
  const list = await api('/assets');
  page.innerHTML = head('מאגר תמונות', 'תמונות שאפשר לצרף לפוסטים: מחלקות, ציוד, צוות שחתם על הסכמה. <b>בלי מטופלים.</b> תמונה נכנסת לשימוש רק אחרי סימון "מאושרת לשימוש".', `<button type="button" class="btn" id="up">${icon('upload')}<span>העלאת תמונה</span></button>`) +
    (list.length ? `<div class="assets">${list.map((a) => `<article class="asset" data-id="${a.id}"><img src="${esc(a.url)}" alt="${esc(a.title)}" loading="lazy"><div class="in"><b>${esc(a.title || 'בלי שם')}</b>${a.notes ? `<span class="xs muted">${esc(a.notes)}</span>` : ''}
      ${a.consent ? '<span class="chip ok">מאושרת לשימוש, הסכמה בתיק</span>' : '<span class="chip warn">עוד לא אושרה</span>'}
      <div class="btns" style="margin-top:6px"><button type="button" class="btn sm ghost" data-edit>${icon('pencil', 'sm')}<span>עריכה</span></button><button type="button" class="btn sm danger-ghost" data-del aria-label="מחיקה">${icon('trash-2', 'sm')}</button></div></div></article>`).join('')}</div>`
      : `<div class="card"><div class="empty">המאגר ריק. כשכללית תעביר תמונות מאושרות, מעלים אותן כאן.</div></div>`);
  const form = (a = {}) => modal({ title: a.id ? 'עריכת תמונה' : 'העלאת תמונה', body: `${a.id ? '' : '<label class="field" style="margin-top:0"><span>קובץ</span><input class="input" type="file" id="fl" accept="image/png,image/jpeg,image/webp"></label>'}
    <label class="field"><span>שם</span><input class="input" id="tt" value="${esc(a.title || '')}" placeholder="למשל: צוות המיון בסורוקה"></label>
    <label class="field"><span>הערות (לא חובה)</span><input class="input" id="nt" value="${esc(a.notes || '')}" placeholder="מי צילם, ממי יש הסכמה"></label>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-top:20px;cursor:pointer;min-height:48px"><input type="checkbox" id="cs" ${a.consent ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px;accent-color:var(--teal)"><span><b>מאושרת לשימוש</b><span class="xs muted" style="display:block">אין בה מטופלים, ויש הסכמה בכתב מכל מי שמופיע בה.</span></span></label>`,
    actions: [{ label: 'ביטול', cls: 'ghost', value: null }, { label: 'שמירה', collect: (m) => ({ file: $('#fl', m)?.files[0], title: $('#tt', m).value, notes: $('#nt', m).value, consent: $('#cs', m).checked }) }] });
  $('#up', page).onclick = async () => {
    const v = await form(); if (!v) return;
    if (!v.file) { toast('לא נבחר קובץ', 'circle-alert'); return; }
    const fd = new FormData(); fd.append('image', v.file); fd.append('title', v.title); fd.append('notes', v.notes); fd.append('consent', v.consent ? '1' : '0');
    try { await api('/assets', { method: 'POST', form: fd }); toast('התמונה נוספה'); go('/images', true); } catch (e) { toast(e.message, 'circle-alert'); }
  };
  $$('[data-id]', page).forEach((card) => {
    const a = list.find((x) => x.id === Number(card.dataset.id));
    $('[data-edit]', card).onclick = async () => { const v = await form(a); if (!v) return; try { await api(`/assets/${a.id}`, { method: 'PATCH', body: { title: v.title, notes: v.notes, consent: v.consent } }); toast('נשמר'); go('/images', true); } catch (e) { toast(e.message, 'circle-alert'); } };
    $('[data-del]', card).onclick = async () => {
      if (!(await confirmDanger('למחוק את התמונה?', 'התמונה תימחק מהמאגר ותוסר מכל פוסט שהיא צורפה אליו. אי אפשר לבטל.', 'מחיקה'))) return;
      try { await api(`/assets/${a.id}`, { method: 'DELETE' }); toast('נמחקה'); go('/images', true); } catch (e) { toast(e.message, 'circle-alert'); }
    };
  });
});

// ---------- weekly summary for ambassadors ----------
function weeklyText(p) {
  const lines = [`היי ${firstName(p.name)}, סיכום קצר של השבוע בתוכנית השגרירים:`];
  if (p.approved.length) lines.push(`אישרת ${p.approved.length === 1 ? 'פוסט אחד' : `${p.approved.length} פוסטים`}${p.approved.length ? `: ${p.approved.map((x) => x.topic).filter(Boolean).join(', ')}` : ''}.`);
  if (p.published.length) lines.push(`${p.published.length === 1 ? 'פוסט אחד עלה' : `${p.published.length} פוסטים עלו`} לרשת.${p.published.some((x) => x.reactions || x.comments) ? ` היו ${p.published.reduce((n, x) => n + (x.reactions || 0), 0)} לייקים ו-${p.published.reduce((n, x) => n + (x.comments || 0), 0)} תגובות.` : ''}`);
  if (p.clicks) lines.push(`${p.clicks} אנשים נכנסו דרך הקישור שלך.`);
  if (p.pending) lines.push(`${p.pending === 1 ? 'פוסט אחד מחכה' : `${p.pending} פוסטים מחכים`} לאישור שלך.`);
  if (lines.length === 1) lines.push('השבוע היה שקט. אם יש לך סיפור מהעבודה, אפשר לשלוח אותו בקישור האישי שלך.');
  lines.push('תודה שאת/ה חלק מזה!');
  return lines.join('\n');
}
on('/summary', async (page) => {
  const d = await api('/summary?days=7');
  page.innerHTML = head('סיכום שבועי לשגרירים', 'הודעה קצרה לכל שגריר/ה על השבוע האחרון: מה אושר, מה עלה, כמה נכנסו דרך הקישור, ותודה. אין טבלת מצטיינים ואין השוואה בין אנשים. עוברים על הנוסח, ושולחים בוואטסאפ.') +
    d.personas.map((p) => `<section class="card" style="margin-bottom:20px" data-slug="${p.slug}"><header><h2>${esc(p.name)}</h2><p>${p.approved.length} אושרו · ${p.published.length} עלו · ${p.clicks} כניסות · ${p.pending} ממתינים</p></header>
      <div class="body"><textarea class="textarea" rows="6" data-msg aria-label="ההודעה ל${esc(p.name)}">${esc(weeklyText(p))}</textarea>
      <div class="btns" style="margin-top:12px"><a class="btn go" data-wa target="_blank" rel="noopener noreferrer" href="${esc(waUrl(p.phone, weeklyText(p)))}">${icon('send')}<span>שליחה בוואטסאפ</span></a><button type="button" class="btn ghost" data-cp>${icon('copy')}<span>העתקה</span></button>${p.phone ? '' : '<span class="xs muted">אין מספר טלפון. וואטסאפ ייפתח לבחירת איש קשר.</span>'}</div></div></section>`).join('');
  $$('[data-slug]', page).forEach((sec) => {
    const p = d.personas.find((x) => x.slug === sec.dataset.slug);
    const ta = $('[data-msg]', sec);
    ta.oninput = () => { $('[data-wa]', sec).href = waUrl(p.phone, ta.value); };
    $('[data-cp]', sec).onclick = async () => { if (await copyText(ta.value)) toast('ההודעה הועתקה'); };
  });
});

// ---------- monthly management report ----------
on('/report', async (page) => {
  const month = new URLSearchParams(location.search).get('month') || localDay().slice(0, 7);
  const d = await api(`/report?month=${month}`);
  const [y, m] = month.split('-').map(Number);
  const shift = (n) => { const t = new Date(y, m - 1 + n, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
  const sum = (k) => d.personas.reduce((n, p) => n + (Number(p[k]) || 0), 0);
  const ratios = d.personas.filter((p) => p.approved && p.edit_ratio != null);
  const avgEdit = ratios.length ? ratios.reduce((n, p) => n + p.edit_ratio, 0) / ratios.length : null;
  page.innerHTML = head(`דוח חודשי: ${MONTHS[m - 1]} ${y}`, 'תמונת מצב של התוכנית להנהלה. אפשר להדפיס או לשמור כ-PDF מכפתור ההדפסה.',
    `<a class="btn ghost sm" href="/report?month=${shift(-1)}">${icon('chevron-right', 'sm')}<span>החודש הקודם</span></a><a class="btn ghost sm" href="/report?month=${shift(1)}"><span>החודש הבא</span>${icon('chevron-left', 'sm')}</a><button type="button" class="btn sm" id="pr">${icon('download', 'sm')}<span>הדפסה או PDF</span></button>`) + `
    <div class="kpis">
      <div class="kpi"><div class="v">${sum('sent')}</div><div class="l">פוסטים שנשלחו לאישור</div><div class="s">${sum('created')} טיוטות נכתבו</div></div>
      <div class="kpi" style="--c:var(--green)"><div class="v">${sum('approved')}</div><div class="l">אושרו על ידי השגרירים</div><div class="s">${sum('edited')} מהם עם שינויים</div></div>
      <div class="kpi" style="--c:var(--deep)"><div class="v">${sum('published')}</div><div class="l">עלו לרשתות</div><div class="s">${sum('reactions')} לייקים · ${sum('comments')} תגובות</div></div>
      <div class="kpi" style="--c:var(--sky)"><div class="v">${sum('clicks')}</div><div class="l">כניסות דרך הקישורים</div><div class="s">${d.candidates} שאלונים חדשים · ${d.stories} סיפורים</div></div>
    </div>
    <section class="card"><header><h2>לפי שגריר/ה</h2><p>"כמה שינו" הוא החלק מהטקסט שהשגריר/ה שינה/תה לפני האישור. ככל שהוא יורד עם הזמן, הכתיבה בקול שלו/ה מדויקת יותר. זה המדד הכי כן לאיכות הקול.</p></header>
      <div class="body flush tablewrap"><table><thead><tr><th>שגריר/ה</th><th>נשלחו</th><th>אושרו</th><th>עלו</th><th>כניסות</th><th>לייקים ותגובות</th><th>כמה שינו</th><th>מגמה, חצי שנה</th></tr></thead>
      <tbody>${d.personas.map((p) => `<tr><td><div class="t" style="font-weight:600">${esc(p.name)}</div><div class="xs muted">${esc(p.role || '')}</div></td><td>${p.sent}</td><td>${p.approved}</td><td>${p.published}</td><td>${p.clicks}</td><td>${(p.reactions || 0) + (p.comments || 0)}</td><td>${p.approved ? pct(p.edit_ratio) : 'אין עדיין'}</td>
        <td>${p.trend.length ? `<span class="spark" title="${esc(p.trend.map((t) => `${t.m}: ${Math.round(t.r * 100)}%`).join(', '))}">${p.trend.map((t) => `<i style="height:${Math.max(2, Math.round(t.r * 28))}px"></i>`).join('')}</span>` : '<span class="xs muted">אין עדיין</span>'}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="card" style="margin-top:24px"><header><h2>שווי משוער</h2><p>כמה היה עולה להגיע לאותה חשיפה בפרסום ממומן. זה אומדן בלבד, לפי התעריפים שמוגדרים במסך "הגדרות", ולא נתון מהרשתות.</p></header>
      <div class="body">${d.rates.cpm || d.rates.cpc ? (() => {
        const imp = sum('impressions'), clk = sum('clicks');
        const value = Math.round((imp / 1000) * d.rates.cpm + clk * d.rates.cpc);
        return `<div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:0"><div class="kpi"><div class="v">${imp.toLocaleString('he-IL')}</div><div class="l">צפיות שדווחו</div><div class="s">לפי ${d.rates.cpm} ₪ לאלף צפיות</div></div><div class="kpi"><div class="v">${clk.toLocaleString('he-IL')}</div><div class="l">כניסות דרך הקישורים</div><div class="s">לפי ${d.rates.cpc} ₪ לכניסה</div></div><div class="kpi" style="--c:var(--green)"><div class="v">${value.toLocaleString('he-IL')} ₪</div><div class="l">שווי משוער החודש</div><div class="s">צפיות נספרות רק כשמישהו מילא אותן</div></div></div>`;
      })() : '<p class="small">כדי לראות שווי משוער, צריך להגדיר תעריף לאלף צפיות ותעריף לכניסה במסך <a class="link" href="/settings">הגדרות</a>.</p>'}</div></section>
    <p class="small muted" style="margin-top:16px">ממוצע השינוי לפני אישור החודש: ${pct(avgEdit)}. כניסות נספרות רק מאנשים, לא מתצוגות מקדימות של הרשתות.</p>`;
  $('#pr', page).onclick = () => window.print();
});

// ---------- settings ----------
on('/settings', async (page) => {
  const s = await api('/settings');
  page.innerHTML = head('הגדרות', 'פרטים שמופיעים למועמדים ולשגרירים, וברירות מחדל לפוסטים.') + `
    <div class="grid g2">
      <section class="card"><header><h2>מי מפעיל את התוכנית</h2><p>מופיע בשאלון למועמדים, כדי שידעו למי לפנות בשאלות ובבקשת מחיקה.</p></header><div class="body">
        <label class="field" style="margin-top:0"><span>שם</span><input class="input" data-k="contact_name" value="${esc(s.contact_name || '')}"></label>
        <label class="field"><span>תפקיד</span><input class="input" data-k="contact_role" value="${esc(s.contact_role || '')}" placeholder="למשל: מנהל/ת תוכנית השגרירים"></label>
        <label class="field"><span>מייל</span><input class="input" data-k="contact_email" dir="ltr" value="${esc(s.contact_email || '')}"></label>
        <label class="field"><span>טלפון</span><input class="input" data-k="contact_phone" dir="ltr" value="${esc(s.contact_phone || '')}"></label>
      </div></section>
      <section class="card"><header><h2>פוסטים</h2></header><div class="body">
        <label class="field" style="margin-top:0"><span>שורת הסתייגות לפוסט רפואי</span><input class="input" data-k="disclaimer" value="${esc(s.disclaimer || '')}"><span class="hint">מוצעת רק כשהפוסט עוסק בנושא רפואי, ולא נוספת בלי שבוחרים בה.</span></label>
        <label class="field"><span>יעד ברירת מחדל לקישורי מעקב</span><input class="input" data-k="link_default_url" dir="ltr" value="${esc(s.link_default_url || '')}" placeholder="https://"><span class="hint">למשל עמוד המשרות של כללית.</span></label>
      </div></section>
      <section class="card"><header><h2>תעריפים לשווי משוער</h2><p>הדוח החודשי מחשב כמה היה עולה להגיע לאותה חשיפה בפרסום ממומן. כדאי לקבל את התעריפים ממחלקת השיווק של כללית.</p></header><div class="body">
        <label class="field" style="margin-top:0"><span>מחיר לאלף צפיות, בשקלים</span><input class="input" data-k="cpm" inputmode="decimal" dir="ltr" value="${esc(s.cpm || '')}"></label>
        <label class="field"><span>מחיר לכניסה, בשקלים</span><input class="input" data-k="cpc" inputmode="decimal" dir="ltr" value="${esc(s.cpc || '')}"></label>
      </div></section>
    </div>
    <div class="btns" style="margin-top:24px"><button type="button" class="btn" id="sv">${icon('save')}<span>שמירה</span></button></div>`;
  $('#sv', page).onclick = async (e) => {
    const body = {}; $$('[data-k]', page).forEach((el) => { body[el.dataset.k] = el.value; });
    busy(e.currentTarget, true, 'שומר...');
    try { await api('/settings', { method: 'PATCH', body }); toast('נשמר'); } catch (er) { toast(er.message, 'circle-alert'); }
    busy(e.currentTarget, false);
  };
});
