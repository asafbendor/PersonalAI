import crypto from 'crypto'
import {
  getAllPersonas,
  getPersonaPosts,
  readPostFile,
  writePostFile,
  ORIGINAL_MARKER,
  type Post,
} from './personas'

// Implements the promise the questionnaire makes in its final question: every
// post written in someone's name is sent to them for review before publication.
//
// Flow: draft -> pending (operator sends it) -> approved (ambassador confirms).
// The ambassador never gets a dashboard account. They get one unguessable link
// that opens exactly one post and nothing else.

export type PostStatus = 'draft' | 'pending' | 'approved'

export interface ReviewTarget {
  personaSlug: string
  personaName: string
  filename: string
  post: Post
}

// 32 hex chars from a CSPRNG. This is the only thing protecting an unpublished
// post, so it must not be derived from the slug, the date, or anything guessable.
function newToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

function nowIso(): string {
  return new Date().toISOString()
}

// Moves a post to "waiting for the ambassador" and mints its review token.
// Re-sending an already-pending post keeps the existing token, so a link the
// ambassador already received does not silently stop working.
export function sendForApproval(
  personaSlug: string,
  filename: string
): { token: string } | null {
  const parsed = readPostFile(personaSlug, filename)
  if (!parsed) return null

  const token = parsed.meta['token'] || newToken()
  parsed.meta['status'] = 'pending'
  parsed.meta['token'] = token
  parsed.meta['נשלח לאישור'] = parsed.meta['נשלח לאישור'] || nowIso()

  writePostFile(personaSlug, filename, parsed)
  return { token }
}

// Tokens are not indexed anywhere, so this scans posts. At the scale this
// project operates at (single digits of ambassadors, tens of posts) a scan is
// simpler and less fragile than maintaining a separate index that could drift.
export function findByToken(token: string): ReviewTarget | null {
  if (!token || !/^[a-f0-9]{32}$/.test(token)) return null

  for (const persona of getAllPersonas()) {
    for (const post of getPersonaPosts(persona.slug)) {
      const parsed = readPostFile(persona.slug, post.filename)
      if (parsed?.meta['token'] === token) {
        return {
          personaSlug: persona.slug,
          personaName: persona.name,
          filename: post.filename,
          post,
        }
      }
    }
  }
  return null
}

export interface ReviewResult {
  ok: boolean
  edited: boolean
}

// The ambassador's decision. If they changed the text, the version the model
// produced is preserved alongside theirs: that difference is the single most
// valuable training signal this system can collect, far better than anything
// self-reported in the questionnaire.
export function submitApproval(token: string, finalContent: string): ReviewResult | null {
  const target = findByToken(token)
  if (!target) return null

  const parsed = readPostFile(target.personaSlug, target.filename)
  if (!parsed) return null

  // Already approved: do not let a re-opened link overwrite a settled decision.
  if (parsed.meta['status'] === 'approved') {
    return { ok: true, edited: parsed.meta['נערך'] === 'true' }
  }

  const original = parsed.body.trim()
  const submitted = finalContent.trim()
  const edited = submitted !== original && submitted.length > 0

  parsed.meta['status'] = 'approved'
  parsed.meta['אושר'] = nowIso()
  parsed.meta['נערך'] = edited ? 'true' : 'false'
  // The token is deliberately kept. What must not happen after approval is a
  // *write*, and the status guard above blocks that. Keeping the token lets an
  // ambassador who reopens their link see "already approved" instead of a page
  // that looks broken. The page shows no post content in that state.

  parsed.body = edited ? `${submitted}${ORIGINAL_MARKER}${original}` : original

  writePostFile(target.personaSlug, target.filename, parsed)
  return { ok: true, edited }
}
