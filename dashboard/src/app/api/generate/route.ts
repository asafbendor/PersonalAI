import { NextResponse } from 'next/server'
import { generatePost } from '@/lib/claude'

export async function POST(req: Request) {
  try {
    const { personaSlugs, platform, topic, marketingAngle, toneVariant } = await req.json()

    if (!personaSlugs?.length || !topic || !platform) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const results = await Promise.all(
      personaSlugs.map(async (slug: string) => {
        const post = await generatePost({ personaSlug: slug, platform, topic, marketingAngle, toneVariant })
        return { slug, post }
      })
    )

    return NextResponse.json({ results })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
