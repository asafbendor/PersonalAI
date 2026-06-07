// Shared slug utilities. Single source of truth for building clean,
// URL-safe, file-path-safe identifiers, used by both candidates.ts and
// personas.ts (and anywhere else that turns a human name into a slug).
//
// IMPORTANT: never derive a slug from non-Latin text (Hebrew, etc.). Keeping
// those characters produces URL-encoded gibberish in links, broken folder
// names on some filesystems, and headaches in git. Only Latin letters/digits
// survive slugify(), everything else is dropped.

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

export function randomSlug(prefix = 'item'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Prefer a Latin-script slug derived from an explicit Latin/English name.
 * Fall back to the primary (possibly non-Latin) name, in case it happens to
 * already be in Latin script. If neither yields anything usable, fall back to
 * a short random id rather than ever producing a non-Latin slug.
 */
export function buildSlug(primary: string, latinHint?: string, prefix = 'item'): string {
  return slugify(latinHint || '') || slugify(primary) || randomSlug(prefix)
}

export function ensureUniqueSlug(base: string, exists: (slug: string) => boolean): string {
  let slug = base
  let i = 2
  while (exists(slug)) {
    slug = `${base}-${i}`
    i++
  }
  return slug
}
