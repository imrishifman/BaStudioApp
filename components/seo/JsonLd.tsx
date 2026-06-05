// Renders a JSON-LD <script> block. Server-safe (no client JS); the structured
// data ships in the SSR HTML so crawlers and AI agents read it on first fetch.
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Structured data is static/server-built, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
