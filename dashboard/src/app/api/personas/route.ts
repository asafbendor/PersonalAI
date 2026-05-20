import { NextResponse } from 'next/server'
import { getAllPersonas } from '@/lib/personas'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const personas = getAllPersonas()
    return NextResponse.json(personas)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
