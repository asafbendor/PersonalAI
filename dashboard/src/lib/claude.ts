import Anthropic from '@anthropic-ai/sdk'
import { getPersonaFull } from './personas'

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
