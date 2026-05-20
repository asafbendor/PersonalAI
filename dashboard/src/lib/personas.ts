import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const DATA_PATH = process.env.DATA_PATH
  ? path.resolve(process.cwd(), process.env.DATA_PATH)
  : path.resolve(process.cwd(), '..')

const PERSONAS_DIR = path.join(DATA_PATH, 'personas')
const OUTPUTS_DIR = path.join(DATA_PATH, 'outputs')

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

function getPersonaSlugs(): string[] {
  if (!fs.existsSync(PERSONAS_DIR)) return []
  return fs.readdirSync(PERSONAS_DIR).filter((d) => {
    return fs.statSync(path.join(PERSONAS_DIR, d)).isDirectory()
  })
}

function parseProfile(slug: string): PersonaMeta | null {
  const profilePath = path.join(PERSONAS_DIR, slug, 'profile.md')
  if (!fs.existsSync(profilePath)) return null

  const raw = fs.readFileSync(profilePath, 'utf-8')
  const { data, content } = matter(raw)

  // Find image
  const personaDir = path.join(PERSONAS_DIR, slug)
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

  const profilePath = path.join(PERSONAS_DIR, slug, 'profile.md')
  const { content } = matter(fs.readFileSync(profilePath, 'utf-8'))

  // Read samples
  const samplesDir = path.join(PERSONAS_DIR, slug, 'samples')
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
  const profilePath = path.join(PERSONAS_DIR, slug, 'profile.md')
  if (!fs.existsSync(profilePath)) return ''
  const { content } = matter(fs.readFileSync(profilePath, 'utf-8'))
  return content
}

export function savePost(personaSlug: string, filename: string, content: string): void {
  const outputDir = path.join(OUTPUTS_DIR, personaSlug)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, filename), content, 'utf-8')
}

export function getImagePath(slug: string, filename: string): string | null {
  const imgPath = path.join(PERSONAS_DIR, slug, filename)
  return fs.existsSync(imgPath) ? imgPath : null
}

export function getVideoPath(slug: string): { path: string; filename: string } | null {
  const personaDir = path.join(PERSONAS_DIR, slug)
  if (!fs.existsSync(personaDir)) return null
  const files = fs.readdirSync(personaDir)
  const videoFile = files.find((f) => /\.(mp4|mov|webm)$/i.test(f))
  if (!videoFile) return null
  return { path: path.join(personaDir, videoFile), filename: videoFile }
}
