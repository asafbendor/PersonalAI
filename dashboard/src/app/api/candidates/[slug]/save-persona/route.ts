import { NextResponse } from 'next/server'
import { getCandidateFull, updateCandidateStatus } from '@/lib/candidates'
import { createPersonaFromDraft } from '@/lib/personas'

// Completes the candidate -> persona flow in one step: takes the (admin
// reviewed, possibly edited) draft profile.md text, writes it as a brand-new
// persona, marks the candidate as converted, and returns the new persona's
// slug so the UI can link straight to its live page. No manual file or git
// steps required, this is the entire "Save as Persona" action.
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const candidate = getCandidateFull(params.slug)
    if (!candidate) {
      return NextResponse.json({ error: 'מועמד לא נמצא' }, { status: 404 })
    }

    const { profileMarkdown } = await req.json()
    if (!profileMarkdown || typeof profileMarkdown !== 'string' || !profileMarkdown.trim()) {
      return NextResponse.json({ error: 'חסר תוכן טיוטה לשמירה' }, { status: 400 })
    }

    const personaSlug = createPersonaFromDraft(candidate.name, candidate.englishName, profileMarkdown)
    updateCandidateStatus(params.slug, 'persona-created')

    return NextResponse.json({ success: true, slug: personaSlug })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
