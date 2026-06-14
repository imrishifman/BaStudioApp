// Upload a rendered PNG to Vercel Blob and return its public URL (Instagram
// fetches the image from this URL at publish time).
import { put } from '@vercel/blob'

export async function uploadPostImage(buffer: Buffer, slug: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token || token.length < 40) {
    throw new Error('BLOB_READ_WRITE_TOKEN not configured')
  }
  const safe = slug.replace(/[^a-z0-9-]+/gi, '-').toLowerCase().slice(0, 60)
  const blob = await put(`social/${safe}.png`, buffer, {
    access: 'public',
    token,
    addRandomSuffix: true,
    contentType: 'image/png',
  })
  return blob.url
}
