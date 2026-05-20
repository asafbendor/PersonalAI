import { NextResponse } from 'next/server'
import { getPersonaPosts } from '@/lib/personas'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const posts = getPersonaPosts(params.slug)
    return NextResponse.json(posts)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
