import { NextResponse } from 'next/server'
import { getImagePath, getVideoPath } from '@/lib/personas'
import fs from 'fs'
import path from 'path'

export async function GET(
  _req: Request,
  { params }: { params: { slug: string; filename: string } }
) {
  const { slug, filename } = params

  const ext = path.extname(filename).toLowerCase()
  const isVideo = ['.mp4', '.mov', '.webm'].includes(ext)

  let filePath: string | null = null

  if (isVideo) {
    const videoInfo = getVideoPath(slug)
    filePath = videoInfo?.path || null
  } else {
    filePath = getImagePath(slug, filename)
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const buffer = fs.readFileSync(filePath)
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
  }

  return new Response(buffer, {
    headers: {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
