import { NextResponse } from 'next/server'

// Reports whether key env vars are present in the running deployment — booleans
// only, never the values. Lets us confirm config on live without exposing secrets.
export async function GET() {
  const present = (v?: string) => typeof v === 'string' && v.trim().length > 0
  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    env: {
      anthropic: present(process.env.ANTHROPIC_API_KEY),
      database: present(process.env.DATABASE_URL),
      authSecret: present(process.env.AUTH_SECRET),
      authUrl: present(process.env.AUTH_URL),
      googleId: present(process.env.AUTH_GOOGLE_ID),
      resend: present(process.env.RESEND_API_KEY),
    },
    // Names only (never values) of any env var mentioning "anthrop" — reveals a
    // misspelled key name. Empty array means no such variable reached the deploy.
    anthropicVarNames: Object.keys(process.env).filter((k) => /anthrop/i.test(k)),
  })
}
