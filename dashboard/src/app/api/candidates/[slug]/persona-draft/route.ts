import { NextResponse } from 'next/server'
import { getCandidateFull } from '@/lib/candidates'
import { generatePersonaDraft } from '@/lib/claude'

// Generates a first-draft persona profile.md from a candidate's questionnaire
// answers, for the admin to review and edit before turning it into a real
// persona. This endpoint does NOT write any files, it only returns a draft for
// review, the admin then clicks "Save as Persona" (save-persona route) which
// writes it and completes the flow, no manual file or git steps anywhere.
export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const candidate = getCandidateFull(params.slug)
    if (!candidate) {
      return NextResponse.json({ error: 'מועמד לא נמצא' }, { status: 404 })
    }
    if (candidate.answeredCount === 0) {
      return NextResponse.json(
        { error: 'למועמד הזה אין עדיין תשובות, אי אפשר ליצור טיוטת פרסונה' },
        { status: 400 }
      )
    }

    const draft = await generatePersonaDraft(candidate)
    return NextResponse.json({ draft })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
