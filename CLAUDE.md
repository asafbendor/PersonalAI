# פרויקט שגרירים (כללית)

דשבורד ניהול בעברית לתוכנית "שגרירי כללית": עובדי כללית (אחיות, רופאים, כלכלנים)
שמפרסמים פוסטים ברשתות בשמם. המערכת מכינה טיוטות בקול של כל שגריר/ה, והשגריר/ה מאשר/ת.

המאגר נקרא `PersonalAI` מסיבות היסטוריות. התיקייה המקומית: `C:\Projects\ambassador`.

## איך עובדים עם אסף

- תשובות בעברית, קצרות, במילים פשוטות. אסף אינו מתכנת. תוכניות בלי שמות קבצים וקוד.
- בלי מקף ארוך, בשום מקום (גם לא בקוד, בהנחיות ל-AI או בטקסט שהמערכת מייצרת).
- לפני תוכנית גדולה: להציע דעה שנייה מהמודלים האחרים (רק הצעה).
- בסוף כל עבודה: לשמור ב-GitHub ולסיים בשורה "נשמר ב-GitHub".

## אזהרה: push ל-main מפרסם לאתר החי

Railway מושך אוטומטית מ-`main`. כל push ל-`main` עולה מיד ל-https://ambassador.up.railway.app.
עד שהמעבר לקלאודפלייר הושלם ואסף אישר, כל שינוי שלא אושר לפרסום הולך לענף עבודה ו-PR.

## הכללים שהקוד אוכף (לא לשבור)

1. **AI מכין טיוטה, אדם מאשר.** טיוטת פרסונה, פוסט ולקח מעריכה אף פעם לא נשמרים או מתפרסמים מעצמם.
2. **קישור האישור הוא הסיסמה.** לשגרירים אין חשבון. הקישור `/review/<token>` מכיל אסימון אקראי
   של 32 תווים, פותח פוסט אחד בלבד, ואין ממנו דרך לאזור הניהול.
3. **פרסום רק אחרי אישור.** כפתורי הפרסום מופיעים רק לפוסט בסטטוס `approved`.
4. **אישור הוא סופי.** קישור שנפתח שוב לא יכול לדרוס נוסח מאושר. רק "שליחה לאישור" מחדש
   מחזירה ל-`pending`, וזה מכוון.
5. **הגשה לא נשמרת לדיסק זמני.** אם האחסון הקבוע לא זמין, השאלון נחסם ולא מקבל תשובות.
6. **מידע אישי של מועמדים** לא נכנס ל-git, לא לצ'אט ולא ללוגים.

## מבנה

| מה | איפה |
|---|---|
| האפליקציה (Next.js 13.5.6, App Router, React 18, Tailwind 3) | `dashboard/` |
| שלוש הפרסונות המסודרות (פרופיל, דוגמאות, תמונה) | `personas/<slug>/` |
| פוסטים שנוצרו לפרסונות המסודרות | `outputs/<slug>/` |
| השאלון, מסמך ייחוס | `שאלון-מועמד-שגריר.md` |
| השאלון, מקור האמת | `dashboard/src/lib/questionnaire.ts` |
| תיעוד מלא של הזרימות | `README.md` |

שינוי בשאלון נעשה בשני המקומות. מזהי שאלות (`q1`, `q2`...) לא ממוחזרים לעולם.

מסכים: `/login`, `/` (לוח בקרה), `/ambassador/<slug>`, `/candidates`, `/generate`,
`/onboarding` (ציבורי), `/review/<token>` (ציבורי).

ספריות הליבה ב-`dashboard/src/lib/`: `storage` (נתיבים ובדיקת אחסון), `personas`, `candidates`,
`approvals` (זרימת האישור), `backup`, `claude` (כל הקריאות ל-AI), `questionnaire`.
ההרשאות ב-`dashboard/src/middleware.ts`.

## איך מריצים

```bash
cd dashboard
npm install
npm run dev      # http://localhost:3000
npm run build    # בדיקה לפני push
```

קובץ `dashboard/.env.local` (לא ב-git): `DASHBOARD_PASSWORD`, `ANTHROPIC_API_KEY`.
מקומית אין צורך ב-`PERSISTENT_DATA_PATH`, הנתונים נכתבים לתיקיות המאגר.
אין בדיקות אוטומטיות ואין lint מוגדר. הבדיקה היא `npm run build` ומעבר ידני על המסכים.

## איפה הנתונים

- **ב-git**: הפרסונות המסודרות, הדוגמאות והתוצרים שלהן. git הוא מקור האמת.
- **רק על ה-Volume של Railway (`/data`)**: תשובות מועמדים (`candidates/`), פרסונות שנוצרו
  באפליקציה (`personas/`), פוסטים עם סטטוס אישור (`outputs/`), ותמונות מצב (`_backups/`).
  אין להם עותק אחר, חוץ מגיבוי שהורד ידנית.
- פוסט הוא קובץ Markdown עם כותרת מטא (סטטוס, אסימון, חותמות זמן). אם השגריר/ה ערך/ה,
  שתי הגרסאות נשמרות באותו קובץ, מופרדות בשורת הערה.
- גיבויים שהורדו נשמרים ב-`C:\Users\HP\secrets\ambassador\backups\`, לא ב-git.

## פריסה

- GitHub: `asafbendor/PersonalAI` (פרטי), ענף `main`.
- Railway: פרויקט "Clalit Ambassador", שירות `PersonalAI`. Nixpacks, פקודת הרצה `npm start`.
- משתני סביבה ב-Railway: `DASHBOARD_PASSWORD`, `ANTHROPIC_API_KEY`, `PERSISTENT_DATA_PATH=/data`.
- בדיקת אחסון אחרי כל שינוי תשתית: `GET /api/health/storage`, מצופה `"level":"volume"`.
- גיבוי מלא: `GET /api/backup/export` (דורש התחברות). מחזיר JSON אחד עם כל ה-Volume.

## חולשות ידועות (מתוכנן לתיקון במעבר)

- עוגיית ההתחברות שומרת את הסיסמה עצמה. צריך עוגיית סשן חתומה.
- אין הגבלת ניסיונות כניסה, אין תפוגה לקישורי אישור, אין הגנת ספאם על השאלון.
- השאלון לא שומר תשובות תוך כדי מילוי. מי שסוגר את הדף מאבד הכל.
- המודל `claude-sonnet-4-6` וה-SDK (0.39) ישנים. אין prompt caching.
- חיפוש פוסט לפי אסימון סורק את כל הקבצים.

## תוכנית המעבר (נובמבר 2026)

יעד: Cloudflare Workers + D1 (מועמדים, פרסונות, פוסטים, אישורים) + R2 (תמונות, סרטון, גיבוי יומי).
Railway נשאר חי עד שאסף בדק את האתר החדש ואישר. רק אסף מחליט על כיבוי.
עיצוב חדש לפי "Clalit Design System": טורקיז מוביל, פינות ישרות, כפתורי גלולה בלבד,
פס חמשת הצבעים, בלי הדרגות צבע ובלי צללים.

## האתר החדש בקלאודפלייר (נבנה 10 בנובמבר 2026)

- הקוד: `worker/`. Worker אחד (`src/index.js`, `src/ai.js`) שמגיש גם את הממשק (`public/`, JS רגיל בלי בנייה).
- כתובת: https://ambassador.asaf-bendor-e90.workers.dev . תת-דומיין ambassador.goai.co.il עוד לא חובר (מחכה לאישור של אסף).
- נתונים: D1 `ambassador` (הסכמה ב-`db/schema.sql`), תמונות וסרטון ב-R2 `ambassador-media` תחת `personas/`, גיבוי יומי (Cron, 00:00 UTC) ל-R2 תחת `backups/`, 60 אחרונים.
- סודות (wrangler secret): DASHBOARD_PASSWORD (העותק ב-`C:\Users\HP\secrets\ambassador\dashboard-password-proposed.txt`), SESSION_SECRET, ANTHROPIC_API_KEY. אופציונלי: BREVO_API_KEY + NOTIFY_EMAIL להתראות במייל, TURNSTILE_SITE_KEY + TURNSTILE_SECRET לשאלון.
- פריסה: `cd worker` ואז `npx wrangler deploy`. push ל-main עדיין מפרסם את Railway, לא את קלאודפלייר.
- ייבוא חד פעמי מ-Railway: `node scripts/import.mjs <backup.json> --remote`. כותב קבצים זמניים עם מידע אישי ל-`scripts/out/` (מחוץ ל-git), למחוק אחרי.
- מודל: claude-opus-5-5. שלוש גרסאות לכל פוסט + קריאה נפרדת שנותנת ציון דמיון לקול. המייל של המועמד לא נשלח ל-AI.

## נתוני אדמין

קריאה בלבד, בלי פרטים מזהים. מתוך `worker/`:

```
npx wrangler d1 execute ambassador --remote --command "SELECT (SELECT COUNT(*) FROM personas) personas, (SELECT COUNT(*) FROM candidates) candidates, (SELECT COUNT(*) FROM candidates WHERE status='new') new_candidates, (SELECT COUNT(*) FROM posts) posts"
npx wrangler d1 execute ambassador --remote --command "SELECT status, COUNT(*) n, SUM(published_at IS NOT NULL) published FROM posts GROUP BY status"
npx wrangler d1 execute ambassador --remote --command "SELECT persona_slug, COUNT(*) sent, SUM(status='approved') approved, SUM(edited) edited FROM posts WHERE sent_at IS NOT NULL GROUP BY persona_slug"
npx wrangler d1 execute ambassador --remote --command "SELECT COUNT(*) waiting_over_week FROM posts WHERE status='pending' AND sent_at < datetime('now','-7 days')"
npx wrangler d1 execute ambassador --remote --command "SELECT substr(submitted_at,1,7) month, COUNT(*) n FROM candidates GROUP BY month"
```
