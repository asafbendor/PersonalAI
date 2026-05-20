import { NextResponse } from 'next/server'
import { savePost } from '@/lib/personas'

export async function POST(req: Request) {
  try {
    const { personaSlug, topic, platform, goal, content } = await req.json()
    if (!personaSlug || !content) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const date = new Date().toISOString().split('T')[0]
    const slug = topic
      .replace(/[^\w֐-׿\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
    const filename = `${date}_${slug}.md`

    const fileContent = `**פרסונה:** ${personaSlug}
**פלטפורמה:** ${platform}
**נושא:** ${topic}
**מטרה:** ${goal}
**status:** draft

---

${content}`

    savePost(personaSlug, filename, fileContent)
    return NextResponse.json({ success: true, filename })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
