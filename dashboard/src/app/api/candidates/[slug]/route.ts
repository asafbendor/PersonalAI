import { NextResponse } from 'next/server'
import { getCandidateFull, updateCandidateStatus } from '@/lib/candidates'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const candidate = getCandidateFull(params.slug)
    if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(candidate)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  try {
    const { status } = await req.json()
    if (!status) return NextResponse.json({ error: 'Missing status' }, { status: 400 })
    const ok = updateCandidateStatus(params.slug, status)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
