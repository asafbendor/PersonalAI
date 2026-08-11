import { NextResponse } from 'next/server'
import { restoreSnapshot, describeSnapshot, type Snapshot } from '@/lib/backup'

export const dynamic = 'force-dynamic'

// Admin-only (middleware). Restores a snapshot produced by the export route.
//
// Default mode is 'merge', which only creates files that are missing. Importing
// yesterday's backup can therefore never wipe today's work by accident, which
// matters because the obvious mistake with a restore button is running it on a
// healthy system.
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const snapshot: Snapshot = body.snapshot
    const mode: 'merge' | 'replace' = body.mode === 'replace' ? 'replace' : 'merge'

    if (!snapshot || !Array.isArray(snapshot.files)) {
      return NextResponse.json(
        { error: 'הקובץ אינו קובץ גיבוי תקין' },
        { status: 400 }
      )
    }

    const before = describeSnapshot(snapshot)
    const result = restoreSnapshot(snapshot, mode)

    return NextResponse.json({
      success: true,
      mode,
      backupCreatedAt: snapshot.createdAt ?? null,
      contained: before,
      ...result,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
