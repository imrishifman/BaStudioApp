// Optional cross-post to the BaStudio Facebook Page (mirror of Instagram).
// No-op (returns null) unless FB_PAGE_ID + FB_PAGE_ACCESS_TOKEN are configured,
// so the IG publish never fails just because FB is not set up yet.

export async function crossPostToFacebook(
  imageUrl: string,
  caption: string,
): Promise<string | null> {
  const pageId = process.env.FB_PAGE_ID
  const token = process.env.FB_PAGE_ACCESS_TOKEN
  if (!pageId || !token) return null
  try {
    const res = await fetch(`https://graph.facebook.com/v23.0/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: imageUrl, caption, access_token: token }).toString(),
    })
    const data = (await res.json()) as { post_id?: string; id?: string }
    return data.post_id ?? data.id ?? null
  } catch {
    return null
  }
}
