import { NextResponse } from 'next/server'
import { sendForApproval } from '@/lib/approvals'

export const dynamic = 'force-dynamic'

// Admin-only (protected by middleware). Returns the review link for the
// operator to pass to the ambassador however they normally reach them.
export async function POST(req: Request) {
  try {
    const { personaSlug, filename } = await req.json()
    if (!personaSlug || !filename) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const result = sendForApproval(personaSlug, filename)
    if (!result) {
      return NextResponse.json({ error: 'הפוסט לא נמצא' }, { status: 404 })
    }

    return NextResponse.json({ success: true, token: result.token })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
