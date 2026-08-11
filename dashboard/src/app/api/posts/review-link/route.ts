import { NextResponse } from 'next/server'
import { getReviewToken } from '@/lib/approvals'

export const dynamic = 'force-dynamic'

// Admin-only. Retrieves an existing review link, including for a post that was
// already approved, so the operator can resend it if the ambassador lost it.
// Read-only with respect to status: unlike send-for-approval this never moves
// an approved post back to pending.
export async function POST(req: Request) {
  try {
    const { personaSlug, filename } = await req.json()
    if (!personaSlug || !filename) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const result = getReviewToken(personaSlug, filename)
    if (!result) {
      return NextResponse.json({ error: 'הפוסט לא נמצא' }, { status: 404 })
    }

    return NextResponse.json({ success: true, token: result.token })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
