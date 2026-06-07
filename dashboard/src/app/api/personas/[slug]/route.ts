import { NextResponse } from 'next/server'
import { getPersonaFull, updatePersonaProfile, deletePersona } from '@/lib/personas'

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

// Updates a persona's profile.md content. Only allowed for personas created
// in-app ("Save as Persona" flow), the curated personas are managed via git,
// see updatePersonaProfile() in lib/personas.ts for the full reasoning.
export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  try {
    const { profileMarkdown } = await req.json()
    if (!profileMarkdown || typeof profileMarkdown !== 'string' || !profileMarkdown.trim()) {
      return NextResponse.json({ error: 'חסר תוכן פרופיל' }, { status: 400 })
    }
    const ok = updatePersonaProfile(params.slug, profileMarkdown)
    if (!ok) {
      return NextResponse.json(
        { error: 'אי אפשר לערוך את הפרסונה הזו דרך המערכת, היא מנוהלת דרך הקוד (git)' },
        { status: 403 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// Permanently deletes a persona. Only allowed for personas created in-app, see
// deletePersona() in lib/personas.ts.
export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const ok = deletePersona(params.slug)
    if (!ok) {
      return NextResponse.json(
        { error: 'אי אפשר למחוק את הפרסונה הזו דרך המערכת, היא מנוהלת דרך הקוד (git)' },
        { status: 403 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
