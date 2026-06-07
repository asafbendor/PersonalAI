import { NextResponse } from 'next/server'
import { getAllCandidates, saveCandidate } from '@/lib/candidates'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const candidates = getAllCandidates()
    return NextResponse.json(candidates)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { name, englishName, role, company, email, answers } = await req.json()
    if (!name || !answers) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const slug = saveCandidate({ name, englishName, role, company, email, answers })
    return NextResponse.json({ success: true, slug })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
