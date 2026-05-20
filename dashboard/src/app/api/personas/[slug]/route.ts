import { NextResponse } from 'next/server'
import { getPersonaFull } from '@/lib/personas'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const persona = getPersonaFull(params.slug)
    if (!persona) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(persona)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
