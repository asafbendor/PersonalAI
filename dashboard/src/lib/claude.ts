import Anthropic from '@anthropic-ai/sdk'
import { getPersonaFull } from './personas'
import { QUESTIONNAIRE_SECTIONS } from './questionnaire'
import type { CandidateFull } from './candidates'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface GenerateOptions {
  personaSlug: string
  platform: string
  topic: string
  marketingAngle: string
  toneVariant?: string
}

export async function generatePost(options: GenerateOptions): Promise<string> {
  const persona = getPersonaFull(options.personaSlug)
  if (!persona) throw new Error(`Persona not found: ${options.personaSlug}`)

  const samplesText = persona.samples
    .map((s, i) => `--- דוגמה ${i + 1} ---\n${s.content}`)
    .join('\n\n')

  const systemPrompt = `אתה כותב תוכן שמתחזה לאדם ספציפי. קרא את הפרופיל ואת דוגמאות הכתיבה ושמור על הקול שלהם בדיוק.

חוקים קשוחים:
- לא להשתמש במקף ארוך (—) בשום מקום
- לא לכתוב שפה שיווקית ישירה ("כנסו", "הירשמו")
- לא להגזים ("הכי טוב בעולם", "מדהים")
- הפוסט צריך להישמע כאילו אדם אמיתי כתב אותו, לא AI
- הזווית השיווקית צריכה להיות משובצת באופן טבעי בתוך הסיפור - לא מוצהרת ישירות
- אורך: 150-280 מילים

פרופיל הפרסונה:
${persona.profileContent}

דוגמאות כתיבה:
${samplesText}`

  const userPrompt = `כתוב פוסט בקולו של ${persona.name}.

פלטפורמה: ${options.platform}
נושא: ${options.topic}
זווית שיווקית: ${options.marketingAngle}
${options.toneVariant ? `טון מיוחד: ${options.toneVariant}` : ''}

החזר את הפוסט בלבד, ללא כותרות, ללא הסבר, ללא metadata.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text.trim()
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

---

## Identity Snapshot

**שם:** ...
**תפקיד:** ...
**מקום עבודה:** ...
**רקע:** ...
**תחום:** ...
**קהל שכותב לו/ה:** ...

---

## Personality in 5 Words

מילה, מילה, מילה, מילה, מילה

---

## Voice Characteristics

### Tone
- ...

### Energy Level
- ...

### Self-Disclosure
- ...

---

## Vocabulary and Phrasing

### Words/phrases they USE often:
- "..."

### Words/phrases they NEVER use:
- ...

### How they open a post:
...

### How they close a post:
...

---

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

---

## Things They Would Never Say

1. ...

---

## Visual Identity

**תיאור ויזואלי לפרומפטים עתידיים (לשימוש עקבי בכל תמונה):**

\`\`\`
<תיאור ויזואלי עקבי באנגלית, לשימוש כפרומפט ליצירת תמונות>
\`\`\`

---

## Marketing Context

**זווית האמינות שלו/ה:**
...

**חפיפה עם קהל יעד:**
...
`

/**
 * Generate a first-draft persona profile.md from a candidate's full
 * questionnaire answers. The draft follows the exact same structure used by
 * the existing hand-built personas (see profile.md under each persona folder),
 * so it can be reviewed, edited, and saved as personas/[slug]/profile.md the same way.
 *
 * IMPORTANT: this returns a DRAFT for human review. The admin must read it,
 * correct anything that misrepresents the candidate, and only then commit it
 * as the persona's profile, exactly like the 3 existing personas were created.
 */
export async function generatePersonaDraft(candidate: CandidateFull): Promise<string> {
  const qaText = QUESTIONNAIRE_SECTIONS.map((section) => {
    const lines = section.questions.map((q) => {
      const answer = candidate.answers[q.id]
      return `שאלה: ${q.text}\nתשובה: ${answer && answer.trim() ? answer.trim() : '(לא נענה)'}`
    })
    return `### ${section.title}\n\n${lines.join('\n\n')}`
  }).join('\n\n')

  const systemPrompt = `אתה עוזר שמסייע לבנות "תאום דיגיטלי" (פרסונה) של בן אדם אמיתי, על בסיס שאלון הכרות מובנה שהוא מילא בעצמו.

המשימה שלך: לקרוא את כל התשובות, ולהפיק טיוטה ראשונה של קובץ פרופיל פרסונה (profile.md), במבנה המדויק שמופיע בתבנית למטה. שמור על אותם כותרות ואותו סדר בדיוק.

חוקים קשוחים:
- לא להשתמש במקף ארוך (—) בשום מקום, השתמש במקף רגיל, נקודתיים, פסיק, או ניסוח מחדש
- הסתמך אך ורק על מה שכתוב בתשובות, אל תמציא עובדות, סיפורים, או ציטוטים שלא מבוססים על מה שהאדם כתב בעצמו
- אם תשובה חסרה או ריקה, אל תמציא תחליף, כתוב "לא צוין" או השאר את השדה כללי יותר
- "Vocabulary and Phrasing" ו-"Content Patterns" צריכים להתבסס בעיקר על תשובות החלקים "איך את/ה מדבר/ת וכותב/ת" ו"סגנון תקשורת ברשתות" (כולל דוגמאות הכתיבה האמיתיות אם יש)
- "Things They Would Never Say" ו"גבולות" מבוססים על תשובות חלק "גבולות ואישור"
- "Marketing Context" ו"קהל שכותב לו/ה" מבוססים על תשובות חלק "כיוון תוכן וקהל"
- "Visual Identity" מבוסס על תשובת השאלה על איך האדם רוצה להיראות/להישדר בתמונה (תרגם את התשובה לתיאור פרומפט באנגלית, עקבי, לשימוש חוזר)
- זוהי טיוטה לעיון אנושי לפני שמירה, אל תוסיף הקדמות, הערות או הסברים, החזר רק את תוכן קובץ ה-profile.md עצמו

תבנית מדויקת לפי אותו מבנה שבו נכתבים כל הפרופילים הקיימים:

${PROFILE_TEMPLATE}`

  const userPrompt = `שם המועמד/ת: ${candidate.name}
תפקיד: ${candidate.role || 'לא צוין'}
ארגון: ${candidate.company || 'לא צוין'}

תשובות השאלון המלאות:

${qaText}

הפק טיוטת profile.md מלאה לפי התבנית וההנחיות. החזר רק את תוכן הקובץ.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text.trim()
}
