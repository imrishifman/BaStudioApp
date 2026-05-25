// Client helper for AI POST calls. Tolerates non-JSON responses (e.g. a Vercel
// function-timeout page) so the user sees a clear message instead of a raw
// "Unexpected token 'A'… is not valid JSON" parse error.
export async function postAI<T = unknown>(
  url: string,
  body: unknown,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  const raw = await res.text()
  let data: unknown
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    // Non-JSON body — almost always a platform timeout or crash page.
    if (res.status === 504 || /timed?\s*out|timeout/i.test(raw)) {
      throw new Error('The AI took too long and timed out. Please try again.')
    }
    throw new Error(
      res.ok ? 'The AI returned an unexpected response. Please try again.' : `Request failed (${res.status}). Please try again.`
    )
  }

  const err = (data as { error?: string })?.error
  if (!res.ok || err) throw new Error(err ?? `Request failed (${res.status})`)
  return data as T
}
