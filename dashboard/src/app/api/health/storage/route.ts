import { NextResponse } from 'next/server'
import { getStorageHealth } from '@/lib/storage'

export const dynamic = 'force-dynamic'

// Lets the owner verify from outside (curl) that the Railway Volume is really
// attached, without having to submit a test questionnaire to find out.
// Deliberately NOT in middleware.ts's public list: it exposes internal paths.
export async function GET() {
  const health = getStorageHealth()
  return NextResponse.json(health, { status: health.ok ? 200 : 503 })
}
