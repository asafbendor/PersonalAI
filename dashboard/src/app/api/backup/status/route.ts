import { NextResponse } from 'next/server'
import { listSnapshots, runAutoBackup, describeSnapshot, buildSnapshot } from '@/lib/backup'

export const dynamic = 'force-dynamic'

// Admin-only (middleware).
// GET reports what is on the volume and when it was last snapshotted.
// POST runs the monthly check, creating a snapshot only if one is due.
export async function GET() {
  try {
    const snapshots = listSnapshots()
    return NextResponse.json({
      current: describeSnapshot(buildSnapshot()),
      snapshots: snapshots.slice(0, 12),
      latest: snapshots[0] ?? null,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST() {
  try {
    return NextResponse.json(runAutoBackup())
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
