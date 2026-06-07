import { NextResponse } from 'next/server'
import { getCandidateFull } from '@/lib/candidates'
import { generatePersonaDraft } from '@/lib/claude'

// Generates a first-draft persona profile.md from a candidate's questionnaire
// answers, for the admin to review, edit, and save manually as
// personas/[slug]/profile.md (same human-reviewed flow as the existing personas).
// This endpoint does NOT write any files, it only returns a draft for review.
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
