// Pure data module (no fs/server-only imports), safe to import from both
// server code (API routes, candidates.ts) and client components (onboarding form,
// candidate review page). This is the single source of truth for question text,
// keep all copies in sync by editing here only.
//
// Question ids are permanent. Answers are stored keyed by id, so a retired
// question keeps its id forever and it is never reused for something else.
// Gaps in the numbering are expected and correct. Display numbering is per
// section (the form renders idx+1), so respondents never see these ids.
//
// Retired in the 2026-08-11 pass, do not reuse:
//   q9  opening line to a friend      readable from the writing samples
//   q11 short vs long sentences       measurable from the writing samples
//   q15 how you express frustration   off-brand for employer branding
//   q17 how you open a text           readable from the writing samples
//   q18 how you close a post          readable from the writing samples
//   q23 a post that felt fake         high effort, low yield
//   q29 recurring situation at work   weakest of the six story prompts
//   q30 pride in the team             overlaps q6
//   q33 "write a post right now"      deters people who do not write, which
//                                     is the very audience this project serves
//   q34 what makes you stop scrolling opinion about others, not own voice
//   q36 patient/client identifying details  covered by policy, not by consent
//   q40 who is your target audience   it is whoever follows them, individually
//   q42 what should the photo convey  decided per post by the operator

export interface QuestionnaireQuestion {
  id: string
  text: string
}

export interface QuestionnaireSection {
  id: string
  title: string
  description: string
  questions: QuestionnaireQuestion[]
}

export const QUESTIONNAIRE_SECTIONS: QuestionnaireSection[] = [
  {
    id: 'identity',
    title: 'מי את/ה',
    description: 'זהות וזווית אישית',
    questions: [
      { id: 'q1', text: 'ספר/י על עצמך כאילו את/ה מציג/ה את עצמך לעמית/ה חדש/ה בעבודה, באופן חופשי, לא רשמי.' },
      { id: 'q2', text: 'מה התפקיד שלך בפועל, יום-יום, כולל דברים שלא כתובים בהגדרת התפקיד הרשמית?' },
      { id: 'q3', text: 'כמה זמן את/ה בתפקיד הזה / בארגון? איך הגעת לכאן?' },
      { id: 'q4', text: 'מה גרם לך לבחור בתחום הזה מלכתחילה, ולמה דווקא במוסד, בתפקיד ובמחלקה שבהם את/ה נמצא/ת היום?' },
      { id: 'q5', text: 'איך עמיתיך לעבודה היו מתארים אותך?' },
      { id: 'q6', text: 'מה את/ה הכי גאה בו בעבודה שלך, גם אם זה משהו קטן שאף אחד לא שם לב אליו?' },
      { id: 'q7', text: 'מה דבר אחד שהיית רוצה שאנשים מבחוץ יבינו על העבודה שלך, ולא מבינים?' },
    ],
  },
  {
    id: 'social',
    title: 'דוגמאות כתיבה',
    description: 'החומר הכי חשוב בשאלון',
    questions: [
      { id: 'q31', text: 'את/ה פעיל/ה ברשתות חברתיות? באילו (לינקדאין, פייסבוק, אינסטגרם, אחר)?' },
      { id: 'q32', text: 'אם יש לך טקסטים שכתבת בעבר, בכל מקום שהוא (פוסט, תגובה ארוכה, הודעת וואטסאפ, מייל לצוות), תוכל/י להדביק כאן 2-3 מהם? לא צריך שיהיו "טובים" או קשורים לעבודה, רק שתכתוב/י אותם בעצמך. זה החומר שהכי עוזר לנו לזהות איך את/ה נשמע/ת.' },
      { id: 'q8', text: 'תכתוב/י כאן פסקה (3-5 משפטים) על משהו שקרה לך השבוע בעבודה, בדיוק כמו שהיית מספר/ת את זה לחבר/ה.' },
    ],
  },
  {
    id: 'voice',
    title: 'איך את/ה מדבר/ת וכותב/ת',
    description: 'ביטויים, הומור, אימוג׳ים',
    questions: [
      { id: 'q10', text: "את/ה משתמש/ת באימוג'ים? באילו הקשרים? אילו אימוג'ים חוזרים אצלך?" },
      { id: 'q12', text: 'יש לך ביטויים, מילות סלנג, או "תגיות" שחוזרות אצלך כל הזמן (גם כאלה שאת/ה אומר/ת בלי לשים לב)?' },
      { id: 'q13', text: 'יש מילה או ביטוי "מקצועי" שאת/ה שומע/ת כל הזמן ומגלגל/ת עיניים ממנו? (למשל "סינרגיה", "שובר שוק", "מצוינות תפעולית")' },
      { id: 'q14', text: 'כשמשהו מצחיק אותך, איך זה בא לידי ביטוי בכתיבה שלך? את/ה כותב/ת בהומור, בציניות, בפשטות?' },
      { id: 'q16', text: 'כשאת/ה מסביר/ה משהו מורכב למישהו, את/ה מתחיל/ה מדוגמה, מהתמונה הגדולה, מהפרטים הקטנים, או משהו אחר?' },
    ],
  },
  {
    id: 'opinions',
    title: 'הזווית המקצועית שלך',
    description: 'מה חשוב לך שיידעו',
    questions: [
      { id: 'q19', text: 'מה הדבר בתחום שלך שהיית רוצה שיקבל יותר תשומת לב, ולא מקבל?' },
      { id: 'q20', text: 'אם היית צריך/ה לסכם את הגישה שלך לעבודה במשפט אחד, מה היית אומר/ת?' },
      { id: 'q21', text: 'יש משהו בתחום שלך שרוב האנשים חושבים עליו דבר אחד, ולדעתך הוא בעצם אחר?' },
      { id: 'q22', text: 'מה השתנה בעבודה שלך בשנים האחרונות, ומה לדעתך חשוב שיידעו על זה?' },
      { id: 'q24', text: 'יש נושא שאת/ה מוצא/ת את עצמך מסביר/ה שוב ושוב, כי אנשים לא מבינים אותו מספיק?' },
      { id: 'q41', text: 'אילו נושאים היית רוצה שיזהו אותך איתם, שיחזרו שוב ושוב בתוכן שנכתב בשמך?' },
    ],
  },
  {
    id: 'stories',
    title: 'סיפורים וחוויות',
    description: 'סיפורים אמיתיים מהעבודה',
    questions: [
      { id: 'q25', text: 'ספר/י על רגע אחד בעבודה שגרם לך להרגיש שאת/ה במקום הנכון.' },
      { id: 'q26', text: 'ספר/י על רגע קשה או מאתגר בעבודה, ואיך התמודדת איתו (אפשר גם לא להיכנס לפרטים רגישים, רק התחושה).' },
      { id: 'q27', text: 'ספר/י על מקרה שבו עזרת למישהו (קולגה, מטופל/ת, לקוח/ה, תלוי בתפקיד) ונשאר לך חרוט בזיכרון.' },
      { id: 'q28', text: 'ספר/י על משהו שלמדת מקולגה, ממנהל/ת, או מאדם שעבדת איתו/איתה, ששינה את הדרך שבה את/ה עובד/ת.' },
    ],
  },
  {
    id: 'boundaries',
    title: 'גבולות ואישור',
    description: 'מה מותר ומה אסור לכתוב בשמך',
    questions: [
      { id: 'q35', text: 'יש נושאים, מילים, או ניסוחים שלא היית רוצה לעולם שייכתבו בשמך, גם אם הם "נשמעים טוב"?' },
      { id: 'q36', text: 'יש משהו אישי שלך שלא היית רוצה שיוזכר בפוסטים בשמך?' },
      { id: 'q37', text: 'יש נושאים רגישים בעבודה שלך (פוליטיים, ארגוניים, אישיים) שהיית רוצה שנימנע מהם לגמרי?' },
      { id: 'q38', text: 'אם פוסט שנכתב בשמך ישמע "כמעט נכון אבל לא בדיוק את/ה", מה יהיה הדבר הראשון שתבדוק/י כדי לתקן אותו?' },
      { id: 'q39', text: 'האם את/ה מבין/ה ומסכים/ה שכל פוסט שייכתב בשמך יישלח אליך לאישור או עריכה לפני שהוא יוצא לאוויר? (כן / לא / יש לי הסתייגות)' },
    ],
  },
]

export const TOTAL_QUESTIONS = QUESTIONNAIRE_SECTIONS.reduce(
  (sum, s) => sum + s.questions.length,
  0
)
