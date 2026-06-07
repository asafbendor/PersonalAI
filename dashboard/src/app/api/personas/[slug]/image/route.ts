import { NextResponse } from 'next/server'
import path from 'path'
import { savePersonaImage } from '@/lib/personas'

export const dynamic = 'force-dynamic'

const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.webp']
const MAX_BYTES = 8 * 1024 * 1024 // 8MB

// Lets the admin upload a profile photo for a persona, deliberately admin-only
// (not exposed in the candidate questionnaire), since the owner wants full
// control over which image represents each ambassador. Only allowed for
// personas created in-app, see savePersonaImage() in lib/personas.ts.
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const formData = await req.formData()
    const file = formData.get('image')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'לא נבחרה תמונה' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'הקובץ גדול מדי, מקסימום 8MB' }, { status: 400 })
    }

    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: 'סוג קובץ לא נתמך, יש להעלות PNG, JPG או WEBP' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ok = savePersonaImage(params.slug, `photo${ext}`, buffer)
    if (!ok) {
      return NextResponse.json(
        { error: 'אי אפשר להעלות תמונה לפרסונה הזו דרך המערכת, היא מנוהלת דרך הקוד (git)' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
