// Every AI call in the app. Rule the whole product rests on: the model drafts, a person approves.
// Nothing here writes to the database; callers decide what to keep.
//
// Privacy: only what the task needs reaches the model. A candidate's email never does,
// and post generation sees the persona profile and samples, never questionnaire answers.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { QUESTIONNAIRE_SECTIONS } from '../public/questionnaire.js';

const MODEL = 'claude-opus-5-5';

// Belt and braces: the prompts forbid the em dash, and anything that slips through is replaced.
export const noEmDash = (s) => String(s ?? '').replace(/\s*—\s*/g, ' - ').replace(/–/g, '-');

function client(env) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('מפתח ה-AI לא הוגדר בשרת');
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

function check(response) {
  if (response.stop_reason === 'refusal') throw new Error('מודל ה-AI סירב לבקשה הזו. כדאי לנסח את הנושא אחרת ולנסות שוב');
  if (response.stop_reason === 'max_tokens') throw new Error('התשובה של מודל ה-AI נקטעה באמצע. כדאי לנסות שוב');
}

function textOf(response) {
  check(response);
  return noEmDash(response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim());
}

const HARD_RULES = `חוקים קשוחים:
- אסור להשתמש במקף ארוך בשום מקום. במקומו: מקף רגיל, נקודתיים, פסיק, או ניסוח מחדש
- בלי שפה שיווקית ישירה ("כנסו", "הירשמו") ובלי הגזמות ("הכי טוב בעולם", "מדהים")
- הפוסט נשמע כמו אדם אמיתי שכותב בעצמו, לא כמו AI ולא כמו מחלקת שיווק
- הזווית השיווקית משובצת בתוך הסיפור באופן טבעי, ולא מוצהרת
- לא ממציאים עובדות, מספרים, שמות מטופלים או אירועים שלא מופיעים בפרופיל או בבקשה
- אורך: 150 עד 280 מילים, אלא אם הפלטפורמה או הבקשה מחייבות אחרת`;

// The persona block is identical for every request about the same persona, so it is cached.
// Volatile details (topic, platform, date) go in the user message, after the breakpoint.
function personaSystem(persona) {
  const samples = persona.samples.map((s, i) => `--- דוגמה ${i + 1} ---\n${s.content}`).join('\n\n');
  return [
    {
      type: 'text',
      text: `אתה כותב פוסטים לרשתות חברתיות בשמו של אדם אמיתי, עובד/ת כללית, שמאשר/ת כל פוסט לפני פרסום.
המטרה: שהפוסט יישמע בדיוק כמוהו. הדוגמאות הן האמת: קצב המשפטים, אורך, אוצר מילים, איך נפתח ואיך נסגר.

${HARD_RULES}

פרופיל הקול של ${persona.name}:
${persona.profile_md}

דוגמאות כתיבה אמיתיות:
${samples || '(אין עדיין דוגמאות, להסתמך על הפרופיל)'}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

const Variants = z.object({
  variants: z.array(z.object({
    approach: z.string().describe('In Hebrew, 3 to 7 words: what makes this version different'),
    text: z.string().describe('The full post in Hebrew, ready to publish'),
  })).describe('Exactly three distinct versions'),
});

export async function generateVariants(env, persona, req) {
  const response = await client(env).messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'high', format: zodOutputFormat(Variants) },
    system: personaSystem(persona),
    messages: [{
      role: 'user',
      content: `כתוב שלוש גרסאות שונות של פוסט בקולו/ה של ${persona.name}. כל גרסה בפתיחה ובמבנה אחרים, וכולן נאמנות לקול.

פלטפורמה: ${req.platform}
נושא: ${req.topic}
זווית שיווקית: ${req.angle || 'לא צוינה'}
${req.tone ? `טון מבוקש: ${req.tone}` : ''}
${req.context ? `הקשר מלוח התוכן: ${req.context}` : ''}

הטקסט עצמו בלבד, בלי כותרות, האשטגים רק אם הם מופיעים בדוגמאות.`,
    }],
  });
  check(response);
  if (!response.parsed_output) throw new Error('התקבל פלט לא תקין ממודל ה-AI');
  return response.parsed_output.variants.slice(0, 3).map((v) => ({ approach: noEmDash(v.approach), text: noEmDash(v.text) }));
}

const Scores = z.object({
  scores: z.array(z.object({
    index: z.number().int().describe('0-based index of the version'),
    score: z.number().int().describe('1 to 10: how much it sounds like the real samples'),
    reason: z.string().describe('One short Hebrew sentence: what sounds like them, or what gives it away'),
  })),
});

// A separate call on purpose: the writer grading its own work is not a check.
export async function scoreVariants(env, persona, variants) {
  const samples = persona.samples.map((s, i) => `--- דוגמה ${i + 1} ---\n${s.content}`).join('\n\n');
  const list = variants.map((v, i) => `### גרסה ${i}\n${v.text}`).join('\n\n');
  const response = await client(env).messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'low', format: zodOutputFormat(Scores) },
    system: `אתה בודק קפדן שמשווה טקסטים לכתיבה האמיתית של אדם. אתה לא מתחשב באיכות התוכן, רק בשאלה אם זה נשמע כמוהו. ציון 10 רק כשאי אפשר להבחין. אסור מקף ארוך.`,
    messages: [{
      role: 'user',
      content: `הכתיבה האמיתית של ${persona.name}:\n\n${samples || persona.profile_md}\n\n---\n\nהגרסאות לבדיקה:\n\n${list}\n\nתן ציון ונימוק קצר לכל גרסה.`,
    }],
  });
  check(response);
  const out = variants.map(() => ({ score: null, reason: '' }));
  for (const s of response.parsed_output?.scores ?? []) {
    if (out[s.index]) out[s.index] = { score: Math.max(1, Math.min(10, Math.round(s.score))), reason: noEmDash(s.reason) };
  }
  return out;
}

const PROFILE_TEMPLATE = `---
name: <שם מלא>
role: <תפקיד>
company: <ארגון>
training-method: questionnaire
training-status: draft
last-updated: <YYYY-MM-DD>
---

# Persona: <שם מלא>

## Identity Snapshot
**שם:** ...
**תפקיד:** ...
**מקום עבודה:** ...
**רקע:** ...
**תחום:** ...
**קהל שכותב לו/ה:** ...

## Personality in 5 Words
מילה, מילה, מילה, מילה, מילה

## Voice Characteristics
### Tone
- ...
### Energy Level
- ...
### Self-Disclosure
- ...

## Vocabulary and Phrasing
### Words/phrases they USE often:
- "..."
### Words/phrases they NEVER use:
- ...
### How they open a post:
...
### How they close a post:
...

## Content Patterns
### Topics they talk about:
1. ...
### Their signature move:
...
### Do they use data/numbers?
...
### Do they tell personal stories?
...
### Post length preference:
...

## Things They Would Never Say
1. ...

## Visual Identity
\`\`\`
<consistent visual description in English, for image prompts>
\`\`\`

## Marketing Context
**זווית האמינות שלו/ה:**
...
**חפיפה עם קהל יעד:**
...`;

// Name, role, organization and answers only. The email address is deliberately left out.
export async function personaDraft(env, candidate) {
  const qa = QUESTIONNAIRE_SECTIONS.map((section) => {
    const lines = section.questions.map((q) => {
      const a = (candidate.answers[q.id] || '').trim();
      return `שאלה: ${q.text}\nתשובה: ${a || '(לא נענה)'}`;
    });
    return `### ${section.title}\n\n${lines.join('\n\n')}`;
  }).join('\n\n');

  const response = await client(env).messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'high' },
    system: `אתה בונה טיוטת פרופיל קול (פרסונה) של אדם אמיתי, מתוך שאלון שהוא מילא בעצמו. אדם יקרא ויתקן את הטיוטה לפני שהיא נשמרת.

כללים:
- אסור מקף ארוך בשום מקום
- רק מה שכתוב בתשובות. בלי להמציא עובדות, סיפורים או ציטוטים. תשובה חסרה: "לא צוין"
- "Vocabulary and Phrasing" ו-"Content Patterns" מבוססים בעיקר על דוגמאות הכתיבה האמיתיות ועל חלק "איך את/ה מדבר/ת וכותב/ת"
- "Things They Would Never Say" מבוסס על חלק "גבולות ואישור"
- מחזירים רק את תוכן הקובץ, במבנה המדויק של התבנית, בלי הקדמה

התבנית:
${PROFILE_TEMPLATE}`,
    messages: [{
      role: 'user',
      content: `שם: ${candidate.name}\nתפקיד: ${candidate.role || 'לא צוין'}\nארגון: ${candidate.company || 'לא צוין'}\nתאריך היום: ${new Date().toISOString().slice(0, 10)}\n\n${qa}`,
    }],
  });
  return textOf(response);
}

// One real correction by an ambassador, turned into reusable voice rules. Returned as a draft:
// a person reads it and adds it to the profile. It is never written to the profile automatically.
export async function voiceLesson(env, persona, original, edited) {
  const response = await client(env).messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    system: `אתה מנתח עריכה שאדם אמיתי עשה בטקסט שנכתב בשמו, כדי לחלץ ממנה כללי כתיבה.
- אסור מקף ארוך
- רק מה שעולה מההבדל בין הגרסאות. תיקון עובדתי או הקלדה בלבד: לכתוב שאין לקח סגנוני
- ניסוח אופרטיבי ("להימנע מ...", "להעדיף..."), עד 5 כללים
- כלל שכבר בפרופיל: לציין את זה במקום לחזור עליו
- רק הטקסט להוספה, בפורמט:

### לקח מעריכה

- כלל`,
    messages: [{
      role: 'user',
      content: `שם: ${persona.name}\n\nהפרופיל:\n${persona.profile_md}\n\n---\nמה שהמערכת כתבה:\n${original}\n\n---\nמה שאושר אחרי עריכה:\n${edited}`,
    }],
  });
  return textOf(response);
}
