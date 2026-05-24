// Shared helpers for the AI routes: robust JSON extraction and human-readable
// error messages so failures surface a real reason instead of a generic blob.

// Pulls a JSON object out of an LLM response: strips ```json fences, then takes
// from the first "{" to the last "}". Throws a clear error if none is found.
export function extractJson<T = unknown>(text: string): T {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('The AI response did not contain JSON')
  }
  return JSON.parse(t.slice(start, end + 1)) as T
}

// Maps SDK/HTTP errors to a friendly message + an HTTP status to return.
export function aiErrorMessage(err: unknown): { message: string; status: number } {
  const e = err as { status?: number; message?: string }
  switch (e?.status) {
    case 401:
      return { message: 'The AI key is invalid or missing. Add a valid ANTHROPIC_API_KEY.', status: 502 }
    case 429:
      return { message: 'The AI is rate-limited or out of credits. Try again shortly, or top up credits.', status: 502 }
    case 529:
    case 503:
      return { message: 'The AI is temporarily overloaded. Please try again in a moment.', status: 502 }
    default:
      return {
        message: e?.message ? `AI request failed: ${e.message}` : 'AI request failed',
        status: 500,
      }
  }
}
