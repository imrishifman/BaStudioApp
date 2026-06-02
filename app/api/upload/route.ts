import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token || token.length < 40) {
    return NextResponse.json(
      { error: 'Image storage is not configured. Connect a Vercel Blob store to enable uploads.' },
      { status: 503 },
    )
  }

  if (!req.body) return NextResponse.json({ error: 'No file received' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const filename = searchParams.get('filename') ?? 'upload'

  try {
    const blob = await put(`uploads/${session.user.id}/${filename}`, req.body, {
      access: 'public',
      token,
      addRandomSuffix: true,
    })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('Blob upload failed:', err)
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
