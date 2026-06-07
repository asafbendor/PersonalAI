import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { QUESTIONNAIRE_SECTIONS, TOTAL_QUESTIONS } from './questionnaire'

const DATA_PATH = process.env.DATA_PATH
  ? path.resolve(process.cwd(), process.env.DATA_PATH)
  : path.resolve(process.cwd(), '..')

// Candidate answers are real user-submitted data and must survive redeploys.
// On Railway, the regular app filesystem is wiped on every deploy, only a
// mounted Volume persists. PERSISTENT_DATA_PATH should point at that volume's
// mount path (e.g. "/data"). Locally (no volume), it falls back to the same
// DATA_PATH used for personas/outputs, so dev keeps working unchanged.
const PERSISTENT_DATA_PATH = process.env.PERSISTENT_DATA_PATH
  ? path.resolve(process.env.PERSISTENT_DATA_PATH)
  : DATA_PATH

const CANDIDATES_DIR = path.join(PERSISTENT_DATA_PATH, 'candidates')

export interface CandidateMeta {
  slug: string
  name: string
  role: string
  company: string
  submittedAt: string
  status: string
  answeredCount: number
}

export interface CandidateFull extends CandidateMeta {
  answers: Record<string, string>
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w֐-׿\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50) || 'candidate'
}

function ensureUniqueSlug(base: string): string {
  if (!fs.existsSync(CANDIDATES_DIR)) return base
  let slug = base
  let i = 2
  while (fs.existsSync(path.join(CANDIDATES_DIR, slug))) {
    slug = `${base}-${i}`
    i++
  }
  return slug
}

function getCandidateSlugs(): string[] {
  if (!fs.existsSync(CANDIDATES_DIR)) return []
  return fs.readdirSync(CANDIDATES_DIR).filter((d) => {
    return fs.statSync(path.join(CANDIDATES_DIR, d)).isDirectory()
  })
}

function parseCandidate(slug: string): CandidateFull | null {
  const answersPath = path.join(CANDIDATES_DIR, slug, 'answers.md')
  if (!fs.existsSync(answersPath)) return null

  const raw = fs.readFileSync(answersPath, 'utf-8')
  const { data, content } = matter(raw)

  // Parse answers from "### qID\n\n**שאלה:** ...\n\n**תשובה:**\n\n<answer>" blocks
  const answers: Record<string, string> = {}
  const regex = /^### (q\d+)\n\n\*\*שאלה:\*\*[^\n]*\n\n\*\*תשובה:\*\*\n\n([\s\S]*?)(?=\n### q\d+|\n---\n|\n*$)/gm
  let match
  while ((match = regex.exec(content)) !== null) {
    const text = match[2].trim()
    answers[match[1]] = text === '_(לא נענה)_' ? '' : text
  }

  const answeredCount = Object.values(answers).filter((a) => a && a.trim().length > 0).length

  return {
    slug,
    name: data.name || slug,
    role: data.role || '',
    company: data.company || '',
    submittedAt: data['submitted-at'] || '',
    status: data.status || 'new',
    answeredCount,
    answers,
  }
}

export function getAllCandidates(): CandidateMeta[] {
  return getCandidateSlugs()
    .map(parseCandidate)
    .filter((c): c is CandidateFull => c !== null)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      role: c.role,
      company: c.company,
      submittedAt: c.submittedAt,
      status: c.status,
      answeredCount: c.answeredCount,
    }))
    .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
}

export function getCandidateFull(slug: string): CandidateFull | null {
  return parseCandidate(slug)
}

export function saveCandidate(input: {
  name: string
  role?: string
  company?: string
  email?: string
  answers: Record<string, string>
}): string {
  if (!fs.existsSync(CANDIDATES_DIR)) fs.mkdirSync(CANDIDATES_DIR, { recursive: true })

  const baseSlug = slugify(input.name)
  const slug = ensureUniqueSlug(baseSlug)
  const candidateDir = path.join(CANDIDATES_DIR, slug)
  fs.mkdirSync(candidateDir, { recursive: true })

  const submittedAt = new Date().toISOString()
  const answeredCount = Object.values(input.answers).filter((a) => a && a.trim().length > 0).length

  const frontmatter = [
    '---',
    `name: "${input.name.replace(/"/g, '\\"')}"`,
    `role: "${(input.role || '').replace(/"/g, '\\"')}"`,
    `company: "${(input.company || '').replace(/"/g, '\\"')}"`,
    `email: "${(input.email || '').replace(/"/g, '\\"')}"`,
    `submitted-at: "${submittedAt}"`,
    `status: "new"`,
    `answered: ${answeredCount}/${TOTAL_QUESTIONS}`,
    '---',
    '',
  ].join('\n')

  const body = QUESTIONNAIRE_SECTIONS.map((section) => {
    const questionsText = section.questions
      .map((q) => {
        const answer = input.answers[q.id] || ''
        return `### ${q.id}\n\n**שאלה:** ${q.text}\n\n**תשובה:**\n\n${answer || '_(לא נענה)_'}\n`
      })
      .join('\n')
    return `## ${section.title}\n\n${questionsText}`
  }).join('\n---\n\n')

  fs.writeFileSync(path.join(candidateDir, 'answers.md'), frontmatter + '\n' + body, 'utf-8')

  return slug
}

export function updateCandidateStatus(slug: string, status: string): boolean {
  const answersPath = path.join(CANDIDATES_DIR, slug, 'answers.md')
  if (!fs.existsSync(answersPath)) return false

  const raw = fs.readFileSync(answersPath, 'utf-8')
  const { data, content } = matter(raw)
  data.status = status

  const frontmatterLines = Object.entries(data).map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : v}`)
  const newRaw = ['---', ...frontmatterLines, '---', '', content].join('\n')
  fs.writeFileSync(answersPath, newRaw, 'utf-8')
  return true
}
