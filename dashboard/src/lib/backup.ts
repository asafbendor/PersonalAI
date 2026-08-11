import fs from 'fs'
import path from 'path'
import { PERSISTENT_DATA_PATH } from './storage'

// Backup and restore for everything that lives ONLY on the Railway volume:
// candidate questionnaire answers, personas created through the app, and posts
// with their approval status and edit history. None of it exists in any git
// repo, and Railway volume backups require the Pro plan, so without this the
// data has exactly one copy in the world.
//
// Deliberately a plain JSON file rather than a zip: no new dependency, one file
// to download and commit, and it diffs readably in git. Binary files (persona
// photos) are base64 encoded.

// Snapshots live on the volume too, and must never be swept into a later
// snapshot, or every backup would contain all previous backups.
const BACKUP_DIR_NAME = '_backups'
const BACKUP_DIR = path.join(PERSISTENT_DATA_PATH, BACKUP_DIR_NAME)

const SNAPSHOT_VERSION = 1
const AUTO_BACKUP_INTERVAL_DAYS = 30

const TEXT_EXTENSIONS = ['.md', '.json', '.txt', '.csv']

export interface SnapshotFile {
  path: string
  encoding: 'utf8' | 'base64'
  content: string
}

export interface Snapshot {
  version: number
  createdAt: string
  source: string
  files: SnapshotFile[]
}

export interface SnapshotStats {
  files: number
  candidates: number
  personas: number
  posts: number
  bytes: number
}

function walk(dir: string, relBase = ''): SnapshotFile[] {
  if (!fs.existsSync(dir)) return []
  const out: SnapshotFile[] = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Skip our own snapshots and anything hidden (e.g. the storage probe)
    if (entry.name.startsWith('.') || entry.name === BACKUP_DIR_NAME) continue

    const abs = path.join(dir, entry.name)
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      out.push(...walk(abs, rel))
      continue
    }
    if (!entry.isFile()) continue

    const isText = TEXT_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
    out.push({
      path: rel,
      encoding: isText ? 'utf8' : 'base64',
      content: fs.readFileSync(abs).toString(isText ? 'utf8' : 'base64'),
    })
  }
  return out
}

// Walks the whole volume rather than looking for known folders on purpose:
// anything added later is captured without anyone remembering to update this.
export function buildSnapshot(): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    source: 'ambassador-dashboard',
    files: walk(PERSISTENT_DATA_PATH),
  }
}

export function describeSnapshot(snapshot: Snapshot): SnapshotStats {
  const top = (prefix: string) =>
    new Set(
      snapshot.files
        .filter((f) => f.path.startsWith(prefix + '/'))
        .map((f) => f.path.split('/')[1])
    ).size

  return {
    files: snapshot.files.length,
    candidates: top('candidates'),
    personas: top('personas'),
    posts: snapshot.files.filter((f) => f.path.startsWith('outputs/') && f.path.endsWith('.md'))
      .length,
    bytes: snapshot.files.reduce((sum, f) => sum + f.content.length, 0),
  }
}

// A path out of a backup file is untrusted input. Anything that escapes the
// volume root is rejected rather than sanitised, so a malformed or hostile
// snapshot cannot write outside the data directory.
function safeTarget(relPath: string): string | null {
  if (!relPath || relPath.startsWith('/') || relPath.includes('\\')) return null
  if (relPath.split('/').some((part) => part === '..' || part === '')) return null

  const abs = path.resolve(PERSISTENT_DATA_PATH, relPath)
  const root = path.resolve(PERSISTENT_DATA_PATH)
  if (abs !== root && !abs.startsWith(root + path.sep)) return null
  return abs
}

export interface RestoreResult {
  written: number
  skipped: number
  rejected: string[]
}

// 'merge' (the default) only creates files that are missing, so importing an
// old backup can never destroy newer work. 'replace' overwrites and is meant
// for restoring into an empty or known-bad volume.
export function restoreSnapshot(snapshot: Snapshot, mode: 'merge' | 'replace'): RestoreResult {
  const result: RestoreResult = { written: 0, skipped: 0, rejected: [] }

  for (const file of snapshot.files ?? []) {
    const target = safeTarget(file.path)
    if (!target) {
      result.rejected.push(file.path)
      continue
    }
    if (mode === 'merge' && fs.existsSync(target)) {
      result.skipped++
      continue
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(
      target,
      Buffer.from(file.content, file.encoding === 'base64' ? 'base64' : 'utf8')
    )
    result.written++
  }
  return result
}

export interface StoredSnapshot {
  filename: string
  createdAt: string
  bytes: number
}

export function listSnapshots(): StoredSnapshot[] {
  if (!fs.existsSync(BACKUP_DIR)) return []
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((filename) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename))
      return { filename, createdAt: stat.mtime.toISOString(), bytes: stat.size }
    })
    .sort((a, b) => b.filename.localeCompare(a.filename))
}

export function writeSnapshotToVolume(): StoredSnapshot {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const snapshot = buildSnapshot()
  const filename = `backup-${snapshot.createdAt.slice(0, 10)}.json`
  const target = path.join(BACKUP_DIR, filename)
  fs.writeFileSync(target, JSON.stringify(snapshot), 'utf-8')
  return { filename, createdAt: snapshot.createdAt, bytes: fs.statSync(target).size }
}

export function readSnapshotFromVolume(filename: string): Snapshot | null {
  if (!/^backup-[\w.-]+\.json$/.test(filename)) return null
  const target = path.join(BACKUP_DIR, filename)
  if (!fs.existsSync(target)) return null
  return JSON.parse(fs.readFileSync(target, 'utf-8'))
}

export interface AutoBackupResult {
  created: boolean
  reason: string
  latest: StoredSnapshot | null
  daysSinceLatest: number | null
}

// There is no scheduler in this app and adding a worker for one job is not
// worth it, so this runs lazily whenever an admin opens the dashboard. The
// dashboard is visited far more often than once a month, which is all the
// precision this needs.
//
// Note the honest limit: a snapshot on the same volume protects against a
// deleted persona or a bad import, NOT against losing the volume itself. For
// that the file has to leave Railway, which is what the download button is for.
export function runAutoBackup(): AutoBackupResult {
  const snapshots = listSnapshots()
  const latest = snapshots[0] ?? null

  if (latest) {
    const days = (Date.now() - new Date(latest.createdAt).getTime()) / 86_400_000
    if (days < AUTO_BACKUP_INTERVAL_DAYS) {
      return {
        created: false,
        reason: `הגיבוי האחרון בן ${Math.floor(days)} ימים, טרם עברו ${AUTO_BACKUP_INTERVAL_DAYS}`,
        latest,
        daysSinceLatest: Math.floor(days),
      }
    }
  }

  const created = writeSnapshotToVolume()
  return {
    created: true,
    reason: latest ? 'עבר חודש מהגיבוי האחרון' : 'לא היה גיבוי קודם',
    latest: created,
    daysSinceLatest: 0,
  }
}
