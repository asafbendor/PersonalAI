import fs from 'fs'
import path from 'path'

// Single source of truth for where this app reads and writes data.
//
// DATA_PATH: the deployed git checkout. Holds curated, version-controlled
// content (the 3 hand-built personas, their samples, generated outputs).
// Wiped and recreated from git on every Railway redeploy, which is fine,
// git is its source of truth.
export const DATA_PATH = process.env.DATA_PATH
  ? path.resolve(process.cwd(), process.env.DATA_PATH)
  : path.resolve(process.cwd(), '..')

// PERSISTENT_DATA_PATH: a mounted Railway Volume. Holds runtime-written data
// that has no other source of truth (candidate questionnaire answers,
// app-created personas). MUST point at a real volume mount in production,
// otherwise every deploy silently destroys real people's submissions.
// Locally there is no volume, so it falls back to DATA_PATH and dev is
// unaffected. getStorageHealth() below is what makes sure that convenient
// fallback never goes unnoticed in production.
export const PERSISTENT_DATA_PATH = process.env.PERSISTENT_DATA_PATH
  ? path.resolve(process.env.PERSISTENT_DATA_PATH)
  : DATA_PATH

// Railway injects RAILWAY_ENVIRONMENT into every deployed container. Its
// presence is what separates "deployed, and a missing volume means data loss"
// from "running on the owner's laptop, where the fallback is correct".
export function isManagedDeploy(): boolean {
  return Boolean(process.env.RAILWAY_ENVIRONMENT)
}

export type StorageLevel = 'local' | 'volume' | 'ephemeral' | 'unwritable'

export interface StorageHealth {
  ok: boolean
  level: StorageLevel
  reason: string
  path: string
}

// Verifies that runtime-written data will actually survive the next deploy.
// Ordered cheapest check first; the write probe only runs when it can tell us
// something the env var alone cannot.
export function getStorageHealth(): StorageHealth {
  if (!isManagedDeploy()) {
    return {
      ok: true,
      level: 'local',
      reason: 'סביבת פיתוח מקומית, אין צורך ב-Volume',
      path: PERSISTENT_DATA_PATH,
    }
  }

  if (!process.env.PERSISTENT_DATA_PATH) {
    return {
      ok: false,
      level: 'ephemeral',
      reason:
        'לא הוגדר PERSISTENT_DATA_PATH. הנתונים נכתבים לדיסק זמני ויימחקו בדיפלוי הבא.',
      path: PERSISTENT_DATA_PATH,
    }
  }

  // The env var can be set while the volume itself was never attached, or
  // attached at a different mount path. Only an actual write proves it.
  try {
    fs.mkdirSync(PERSISTENT_DATA_PATH, { recursive: true })
    const probe = path.join(PERSISTENT_DATA_PATH, '.storage-probe')
    fs.writeFileSync(probe, 'ok', 'utf-8')
    fs.readFileSync(probe, 'utf-8')
    fs.unlinkSync(probe)
  } catch (e) {
    return {
      ok: false,
      level: 'unwritable',
      reason: `הנתיב ${PERSISTENT_DATA_PATH} מוגדר אך לא ניתן לכתיבה: ${String(e)}`,
      path: PERSISTENT_DATA_PATH,
    }
  }

  return {
    ok: true,
    level: 'volume',
    reason: 'Volume מחובר וניתן לכתיבה',
    path: PERSISTENT_DATA_PATH,
  }
}
