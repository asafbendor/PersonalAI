import { NextResponse } from 'next/server'
import { getPersonaPosts, getProfileRawContent, getPersonaFull } from '@/lib/personas'
import { generateVoiceLesson } from '@/lib/claude'

export const dynamic = 'force-dynamic'

// Admin-only. Reads the two versions of an approved-and-edited post and returns
// a draft set of voice rules for the operator to review and paste into the
// profile. Never writes to profile.md on its own.
export async function POST(req: Request) {
  try {
    const { personaSlug, filename } = await req.json()
    if (!personaSlug || !filename) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const post = getPersonaPosts(personaSlug).find((p) => p.filename === filename)
    if (!post) {
      return NextResponse.json({ error: 'הפוסט לא נמצא' }, { status: 404 })
    }
    if (!post.originalContent) {
      return NextResponse.json(
        { error: 'לפוסט הזה אין גרסה מקורית להשוואה, כלומר הוא אושר בלי עריכה' },
        { status: 400 }
      )
    }

    const persona = getPersonaFull(personaSlug)
    const lesson = await generateVoiceLesson(
      persona?.name || personaSlug,
      getProfileRawContent(personaSlug),
      post.originalContent,
      post.content
    )

    return NextResponse.json({ lesson })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
