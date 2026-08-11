import { NextResponse } from 'next/server'
import { getAllCandidates, saveCandidate } from '@/lib/candidates'
import { getStorageHealth } from '@/lib/storage'

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
    // Refuse the submission rather than accept 42 answers onto a disk that the
    // next deploy will erase. This already cost one real submission once.
    const health = getStorageHealth()
    if (!health.ok) {
      console.error(`[storage] refusing candidate submission: ${health.reason}`)
      return NextResponse.json(
        { error: 'האחסון אינו זמין כרגע, ההגשה לא נשמרה. נסו שוב מאוחר יותר.' },
        { status: 503 }
      )
    }

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
