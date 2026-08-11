import { NextResponse } from 'next/server'
import { buildSnapshot, describeSnapshot } from '@/lib/backup'

export const dynamic = 'force-dynamic'

// Admin-only (middleware). Streams the whole volume as one JSON file.
// GET rather than POST so the browser can download it with a plain link.
export async function GET() {
  try {
    const snapshot = buildSnapshot()
    const stats = describeSnapshot(snapshot)
    const filename = `ambassador-backup-${snapshot.createdAt.slice(0, 10)}.json`

    return new NextResponse(JSON.stringify(snapshot, null, 1), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Lets the UI report what was included without parsing the download
        'X-Backup-Files': String(stats.files),
        'X-Backup-Candidates': String(stats.candidates),
        'X-Backup-Personas': String(stats.personas),
        'X-Backup-Posts': String(stats.posts),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
