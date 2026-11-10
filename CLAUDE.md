# פרויקט שגרירים (כללית)

מערכת ניהול בעברית לתוכנית "שגרירי כללית": עובדי כללית (אחיות, רופאים, כלכלנים) שמפרסמים
פוסטים ברשתות בשמם. המערכת מכינה טיוטות בקול של כל שגריר/ה, והשגריר/ה מאשר/ת לפני כל פרסום.

המאגר נקרא `PersonalAI` מסיבות היסטוריות. התיקייה המקומית: `C:\Projects\ambassador`.

## איך עובדים עם אסף

- תשובות בעברית, קצרות, במילים פשוטות. אסף אינו מתכנת. תוכניות בלי שמות קבצים וקוד.
- בלי מקף ארוך, בשום מקום (גם לא בקוד, בהנחיות ל-AI או בטקסט שהמערכת מייצרת).
- לפני תוכנית גדולה: להציע דעה שנייה מהמודלים האחרים (רק הצעה).
- בסוף כל עבודה: לשמור ב-GitHub ולסיים בשורה "נשמר ב-GitHub".

## המצב היום (10 בנובמבר 2026)

- **האתר החי**: Cloudflare Worker בשם `ambassador`, בכתובת https://ambassador.asaf-bendor-e90.workers.dev .
  הכתובת ambassador.goai.co.il עוד לא חוברה, וזה מחכה לאישור של אסף.
- **push ל-main לא מפרסם שום דבר לבד.** הפרסום נעשה רק ב-`npx wrangler deploy` מתוך `worker/`.
- **Railway נמחק** ב-10 בנובמבר 2026. המחיקה הסופית אצלם ב-12 בנובמבר 2026. הכתובת הישנה
  (ambassador.up.railway.app) לא עונה יותר, וקישורים ישנים אליה לא עובדים.
- `dashboard/` הוא האפליקציה הישנה (Next.js), שנשמרה רק לתיעוד. לא מריצים ולא מפרסמים אותה.
  אפשר למחוק אותה ואת הענפים הישנים כשאסף ירצה.

## הכללים שהקוד אוכף (לא לשבור)

1. **AI מכין טיוטה, אדם מאשר.** טיוטת פרסונה, פוסט, לקח מעריכה והצעת פרופיל לא נשמרים לפרופיל
   ולא מתפרסמים מעצמם. בדיקת הבטיחות רק מסמנת, לא חוסמת ולא משנה טקסט.
2. **בלי המצאות בשם אדם אמיתי.** פרט שלא הגיע מהחומר של השגריר/ה מסומן ומוצג לו/ה בעמוד האישור.
3. **קישור האישור הוא הסיסמה.** לשגרירים אין חשבון. `/review/<token>` (32 תווים אקראיים) פותח פוסט
   אחד בלבד, בלי דרך לאזור הניהול. קישור ממתין פג אחרי 14 יום. פוסט מאושר נשאר קריא.
4. **אישור הוא סופי.** פתיחה חוזרת של הקישור לא דורסת נוסח מאושר. רק "שליחה לאישור מחדש" מהניהול
   מחזירה ל"ממתין".
5. **פרסום רק אחרי אישור, ורק על ידי השגריר/ה.** המערכת לא מפרסמת ולא שולחת הודעות בעצמה.
   כפתורי וואטסאפ פותחים הודעה מוכנה אצל המפעיל, והוא לוחץ שליחה.
6. **מזהי שאלות קבועים.** `q1`, `q2`... לא ממוחזרים. שאלה שהוצאה משאירה פער.
7. **מידע אישי** של מועמדים ושגרירים לא נכנס ל-git, לצ'אט וללוגים. המייל של מועמד/ת לא נשלח ל-AI.
8. **noindex בכל מקום** ו-`robots.txt` חוסם הכל. כותרת `referrer-policy: no-referrer`, כדי שאסימון
   האישור לא ידלוף לרשתות.

## מבנה

| מה | איפה |
|---|---|
| השרת: כל הנתיבים, הרשאות, גיבוי יומי | `worker/src/index.js` |
| כל הקריאות ל-AI (claude-opus-5-5) | `worker/src/ai.js` |
| הממשק (JS רגיל, בלי שלב בנייה) | `worker/public/` |
| השאלון, מקור האמת (משותף לשרת ולדפדפן) | `worker/public/questionnaire.js` |
| ערבית ורוסית לשאלון, לעמוד האישור ולעמוד הסיפורים | `worker/public/i18n.js` |
| הסכמה של המסד, ושינויים לפי סדר | `worker/db/schema.sql`, `migrate-002.sql`, `migrate-003.sql` |
| ייבוא חד פעמי מקבצי הגיבוי של Railway | `worker/scripts/import.mjs` |
| הפרסונות והפוסטים המקוריים (מקור הייבוא) | `personas/`, `outputs/` |
| האפליקציה הישנה, לתיעוד בלבד | `dashboard/` |

שינוי בשאלון נעשה ב-`questionnaire.js`, ואם צריך גם ב-`i18n.js` (התרגום שומר על סדר האפשרויות).
התרגום לערבית ולרוסית ממתין לבדיקה של דובר/ת שפת אם לפני שליחה למועמדים אמיתיים.

## איך מריצים מקומית

```bash
cd worker
npm install
npx wrangler d1 execute ambassador --local --file db/schema.sql
npx wrangler d1 execute ambassador --local --file db/migrate-002.sql
npx wrangler d1 execute ambassador --local --file db/migrate-003.sql
npx wrangler dev            # http://localhost:8787
```

קובץ `worker/.dev.vars` (לא ב-git): `DASHBOARD_PASSWORD`, `SESSION_SECRET`, ואם צריך AI גם `ANTHROPIC_API_KEY`.
אין בדיקות אוטומטיות. הבדיקה: `node --check` לכל קובץ, ומעבר על המסכים ברוחב מחשב וברוחב טלפון צר.

## פריסה

```bash
cd worker
npx wrangler deploy
```

- שינוי במסד: קובץ `migrate-00N.sql` חדש, מריצים `--local` ואז `--remote`, ורק אחר כך פורסים.
- סודות (wrangler secret, לא בקוד): `DASHBOARD_PASSWORD` (עותק ב-`C:\Users\HP\secrets\ambassador\dashboard-password-proposed.txt`),
  `SESSION_SECRET`, `ANTHROPIC_API_KEY`. אופציונלי: `BREVO_API_KEY` + `NOTIFY_EMAIL` להתראות במייל,
  `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET` לשאלון, `CANONICAL_HOST` + `PUBLIC_URL` כשיחובר דומיין.
- החלפת הסיסמה מנתקת את כל מי שמחובר (החתימה של הסשן תלויה בה).

## איפה הנתונים

- **D1 `ambassador`**: שגרירים, דוגמאות כתיבה, מועמדים, פוסטים (כולל הנוסח המקורי לפני עריכה,
  סטטוס, אסימון, תזמון, פרסום, תגובות), נושאים, סיפורים, קישורי מעקב וכניסות, מאגר תמונות,
  הגדרות, יומן פעילות.
- **R2 `ambassador-media`**: תמונות וסרטונים תחת `personas/`, מאגר התמונות תחת `assets/`,
  וגיבוי יומי של כל הטבלאות תחת `backups/` (Cron ב-00:00 UTC, נשמרים 60 אחרונים).
- גיבויים שהורדו למחשב: `C:\Users\HP\secrets\ambassador\backups\`, לא ב-git. שם גם הגיבוי
  האחרון מ-Railway לפני המחיקה.

## נתוני אדמין

קריאה בלבד, בלי פרטים מזהים. מתוך `worker/`:

```
npx wrangler d1 execute ambassador --remote --command "SELECT (SELECT COUNT(*) FROM personas) personas, (SELECT COUNT(*) FROM candidates) candidates, (SELECT COUNT(*) FROM candidates WHERE status='new') new_candidates, (SELECT COUNT(*) FROM posts) posts, (SELECT COUNT(*) FROM stories WHERE status='new') new_stories"
npx wrangler d1 execute ambassador --remote --command "SELECT status, COUNT(*) n, SUM(published_at IS NOT NULL) published FROM posts GROUP BY status"
npx wrangler d1 execute ambassador --remote --command "SELECT persona_slug, COUNT(*) sent, SUM(status='approved') approved, SUM(edited) edited, ROUND(AVG(edit_ratio),2) avg_edit FROM posts WHERE sent_at IS NOT NULL GROUP BY persona_slug"
npx wrangler d1 execute ambassador --remote --command "SELECT COUNT(*) waiting_over_3_days FROM posts WHERE status='pending' AND sent_at < datetime('now','-3 days')"
npx wrangler d1 execute ambassador --remote --command "SELECT persona_slug, SUM(clicks) clicks FROM links GROUP BY persona_slug"
npx wrangler d1 execute ambassador --remote --command "SELECT substr(submitted_at,1,7) month, COUNT(*) n FROM candidates GROUP BY month"
npx wrangler d1 execute ambassador --remote --command "SELECT substr(at,1,10) day, kind, COUNT(*) n FROM activity GROUP BY day, kind ORDER BY day DESC LIMIT 30"
```

## פתוח

- חיבור ambassador.goai.co.il (צריך אישור של אסף, נוגע בדומיין שיש עליו אתרים חיים).
- התראות במייל: חסר מפתח שליחה.
- הוספת המוצר ללוח המעקב ולשפת המוצר: מחכה להחלטה של אסף.
- תעריפים לשווי משוער ופרטי איש הקשר: אסף ממלא במסך "הגדרות".
