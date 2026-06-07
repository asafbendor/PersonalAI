import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { buildSlug, ensureUniqueSlug } from './slug'

const DATA_PATH = process.env.DATA_PATH
  ? path.resolve(process.cwd(), process.env.DATA_PATH)
  : path.resolve(process.cwd(), '..')

const PERSONAS_DIR = path.join(DATA_PATH, 'personas')
const OUTPUTS_DIR = path.join(DATA_PATH, 'outputs')

// Personas created at runtime (e.g. from a candidate's questionnaire via the
// "Save as Persona" flow) cannot be written into PERSONAS_DIR, that path comes
// from the deployed git checkout and gets wiped on every Railway redeploy.
// Instead they're written under the same persistent volume used for candidate
// answers (PERSISTENT_DATA_PATH, falls back to DATA_PATH locally), and read
// back by merging both locations. The 3 original hand-built personas live in
// PERSONAS_DIR (curated, git-tracked); anything created via the app lives here.
const PERSISTENT_DATA_PATH = process.env.PERSISTENT_DATA_PATH
  ? path.resolve(process.env.PERSISTENT_DATA_PATH)
  : DATA_PATH
const RUNTIME_PERSONAS_DIR = path.join(PERSISTENT_DATA_PATH, 'personas')

// Resolve which directory actually holds a given persona's profile.md,
// checking the curated git-tracked location first, then the runtime one.
function personaDirFor(slug: string): string | null {
  for (const dir of [PERSONAS_DIR, RUNTIME_PERSONAS_DIR]) {
    if (fs.existsSync(path.join(dir, slug, 'profile.md'))) return path.join(dir, slug)
  }
  return null
}

export interface PersonaMeta {
  slug: string
  name: string
  role: string
  company: string
  age?: number
  trainingStatus: string
  lastUpdated: string
  personalityWords: string
  imagePath: string | null
  hasVideo: boolean
  postCount: number
  // True for personas created at runtime via the app (e.g. "Save as Persona"
  // from a candidate). Only these can be edited, have their photo uploaded, or
  // be deleted from the UI, the 3 curated personas ship with the git checkout
  // and any in-app changes to them would be silently discarded on the next
  // redeploy (and could strip them from version control unexpectedly).
  isRuntime: boolean
}

export interface PersonaFull extends PersonaMeta {
  profileContent: string
  samples: { filename: string; content: string }[]
}

export interface Post {
  slug: string
  personaSlug: string
  filename: string
  date: string
  topic: string
  platform: string
  goal: string
  status: string
  content: string
}

// True only for personas that live exclusively in the runtime/volume-backed
// directory, i.e. were created via the app and not part of the curated git
// checkout (even if a curated persona of the same slug somehow also existed,
// we treat that as curated-owned and don't allow in-app mutation of it).
function isRuntimePersona(slug: string): boolean {
  return (
    fs.existsSync(path.join(RUNTIME_PERSONAS_DIR, slug, 'profile.md')) &&
    !fs.existsSync(path.join(PERSONAS_DIR, slug, 'profile.md'))
  )
}

function getPersonaSlugs(): string[] {
  const slugs = new Set<string>()
  for (const dir of [PERSONAS_DIR, RUNTIME_PERSONAS_DIR]) {
    if (!fs.existsSync(dir)) continue
    fs.readdirSync(dir).forEach((d) => {
      if (fs.statSync(path.join(dir, d)).isDirectory()) slugs.add(d)
    })
  }
  return Array.from(slugs)
}

function parseProfile(slug: string): PersonaMeta | null {
  const personaDir = personaDirFor(slug)
  if (!personaDir) return null
  const profilePath = path.join(personaDir, 'profile.md')

  const raw = fs.readFileSync(profilePath, 'utf-8')
  const { data, content } = matter(raw)

  // Find image
  const files = fs.readdirSync(personaDir)
  const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
  const videoFile = files.find((f) => /\.(mp4|mov|webm)$/i.test(f))

  // Count posts
  const outputDir = path.join(OUTPUTS_DIR, slug)
  let postCount = 0
  if (fs.existsSync(outputDir)) {
    postCount = fs.readdirSync(outputDir).filter((f) => f.endsWith('.md')).length
  }

  // Extract personality words from content
  const personalityMatch = content.match(/## Personality in 5 Words\n\n(.+)/m)
  const personalityWords = personalityMatch ? personalityMatch[1].trim() : ''

  return {
    slug,
    name: data.name || slug,
    role: data.role || '',
    company: data.company || '',
    trainingStatus: data['training-status'] || 'draft',
    lastUpdated: data['last-updated'] || '',
    personalityWords,
    imagePath: imgFile ? `/api/image/${slug}/${imgFile}` : null,
    hasVideo: !!videoFile,
    postCount,
    isRuntime: isRuntimePersona(slug),
  }
}

export function getAllPersonas(): PersonaMeta[] {
  return getPersonaSlugs()
    .map(parseProfile)
    .filter(Boolean) as PersonaMeta[]
}

export function getPersonaFull(slug: string): PersonaFull | null {
  const meta = parseProfile(slug)
  if (!meta) return null

  const personaDir = personaDirFor(slug)!
  const { content } = matter(fs.readFileSync(path.join(personaDir, 'profile.md'), 'utf-8'))

  // Read samples
  const samplesDir = path.join(personaDir, 'samples')
  const samples: { filename: string; content: string }[] = []
  if (fs.existsSync(samplesDir)) {
    fs.readdirSync(samplesDir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .forEach((f) => {
        samples.push({
          filename: f,
          content: fs.readFileSync(path.join(samplesDir, f), 'utf-8'),
        })
      })
  }

  return { ...meta, profileContent: content, samples }
}

export function getPersonaPosts(slug: string): Post[] {
  const outputDir = path.join(OUTPUTS_DIR, slug)
  if (!fs.existsSync(outputDir)) return []

  return fs
    .readdirSync(outputDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .reverse()
    .map((filename) => {
      const raw = fs.readFileSync(path.join(outputDir, filename), 'utf-8')

      // Parse custom frontmatter (bold key: value format)
      const lines = raw.split('\n')
      const meta: Record<string, string> = {}
      let bodyStart = 0

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^\*\*(.+?):\*\*\s*(.*)$/)
        if (match) {
          meta[match[1].trim()] = match[2].trim()
        } else if (lines[i].startsWith('---')) {
          bodyStart = i + 1
          break
        }
      }

      const content = lines.slice(bodyStart).join('\n').trim()
      const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/)

      return {
        slug: filename.replace('.md', ''),
        personaSlug: slug,
        filename,
        date: dateMatch ? dateMatch[1] : '',
        topic: meta['נושא'] || meta['Topic'] || '',
        platform: meta['פלטפורמה'] || meta['Platform'] || '',
        goal: meta['מטרה'] || meta['Goal'] || '',
        status: meta['status'] || 'draft',
        content,
      }
    })
}

export function getProfileRawContent(slug: string): string {
  const personaDir = personaDirFor(slug)
  if (!personaDir) return ''
  const { content } = matter(fs.readFileSync(path.join(personaDir, 'profile.md'), 'utf-8'))
  return content
}

export function savePost(personaSlug: string, filename: string, content: string): void {
  const outputDir = path.join(OUTPUTS_DIR, personaSlug)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, filename), content, 'utf-8')
}

export function getImagePath(slug: string, filename: string): string | null {
  const personaDir = personaDirFor(slug)
  if (!personaDir) return null
  const imgPath = path.join(personaDir, filename)
  return fs.existsSync(imgPath) ? imgPath : null
}

export function getVideoPath(slug: string): { path: string; filename: string } | null {
  const personaDir = personaDirFor(slug)
  if (!personaDir) return null
  const files = fs.readdirSync(personaDir)
  const videoFile = files.find((f) => /\.(mp4|mov|webm)$/i.test(f))
  if (!videoFile) return null
  return { path: path.join(personaDir, videoFile), filename: videoFile }
}

function personaSlugExists(slug: string): boolean {
  return [PERSONAS_DIR, RUNTIME_PERSONAS_DIR].some((dir) =>
    fs.existsSync(path.join(dir, slug))
  )
}

// Creates a brand-new persona at runtime from an (admin-reviewed, possibly
// edited) draft profile.md, typically generated from a candidate's
// questionnaire answers via the in-app "Save as Persona" flow. Written under
// the persistent volume (RUNTIME_PERSONAS_DIR) so it survives redeploys and is
// immediately usable for post generation, exactly like the curated personas.
//
// The slug is derived here (not passed in) so this is the one place that
// decides persona slugs and guarantees uniqueness against BOTH curated and
// runtime personas. Prefers a Latin "english name" hint (e.g. the candidate's
// englishName) over the display name, for the same reason candidate slugs do,
// Hebrew text must never end up in a slug.
export function createPersonaFromDraft(
  name: string,
  englishNameHint: string | undefined,
  profileMarkdown: string
): string {
  const baseSlug = buildSlug(name, englishNameHint, 'persona')
  const slug = ensureUniqueSlug(baseSlug, personaSlugExists)
  const personaDir = path.join(RUNTIME_PERSONAS_DIR, slug)
  fs.mkdirSync(personaDir, { recursive: true })
  fs.writeFileSync(path.join(personaDir, 'profile.md'), profileMarkdown, 'utf-8')
  return slug
}

// Overwrites profile.md for a persona created via the app. Restricted to
// runtime personas, see isRuntimePersona() for why curated ones are excluded.
// Returns false (and writes nothing) if the persona isn't a runtime persona.
export function updatePersonaProfile(slug: string, profileMarkdown: string): boolean {
  if (!isRuntimePersona(slug)) return false
  const personaDir = path.join(RUNTIME_PERSONAS_DIR, slug)
  fs.writeFileSync(path.join(personaDir, 'profile.md'), profileMarkdown, 'utf-8')
  return true
}

// Saves an admin-uploaded photo for a persona created via the app. Replaces
// any existing profile photo (a persona has exactly one). Restricted to
// runtime personas for the same reason as updatePersonaProfile, the curated
// personas already ship with their photos as part of the git checkout.
export function savePersonaImage(slug: string, filename: string, buffer: Buffer): boolean {
  if (!isRuntimePersona(slug)) return false
  const personaDir = path.join(RUNTIME_PERSONAS_DIR, slug)
  fs.readdirSync(personaDir)
    .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .forEach((f) => fs.unlinkSync(path.join(personaDir, f)))
  fs.writeFileSync(path.join(personaDir, filename), buffer)
  return true
}

// Permanently removes a persona created via the app, including its profile,
// photo, samples, everything under its directory in the persistent volume.
// Restricted to runtime personas, deleting a curated persona's directory would
// only be temporary (restored from git on next redeploy) and confusing.
// Generated posts under outputs/[slug]/ are intentionally left untouched, they
// are a record of what was published and stay even if the persona is removed.
export function deletePersona(slug: string): boolean {
  if (!isRuntimePersona(slug)) return false
  const personaDir = path.join(RUNTIME_PERSONAS_DIR, slug)
  fs.rmSync(personaDir, { recursive: true, force: true })
  return true
}
