import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filename = searchParams.get('filename') ?? 'upload'

  const blob = await put(`uploads/${session.user.id}/${filename}`, req.body!, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  })

  return NextResponse.json({ url: blob.url })
}
