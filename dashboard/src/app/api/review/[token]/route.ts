import { NextResponse } from 'next/server'
import { submitApproval } from '@/lib/approvals'

export const dynamic = 'force-dynamic'

// Public by design: the ambassador has no account, the token is the credential.
// Listed in middleware's public routes. Never widen this to return anything
// beyond the single post the token points at.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const { content } = await req.json()
    if (typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'הפוסט ריק' }, { status: 400 })
    }

    const result = submitApproval(params.token, content)
    if (!result) {
      return NextResponse.json({ error: 'הקישור אינו תקף' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
