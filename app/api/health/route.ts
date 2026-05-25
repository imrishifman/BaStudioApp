import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Reports env-var presence (booleans only, never values) AND whether the
// deployment can actually reach the database — so we can tell config issues
// (missing key) apart from connectivity issues (wrong DB host on Vercel).
export async function GET() {
  const present = (v?: string) => typeof v === 'string' && v.trim().length > 0

  let dbConnects = false
  let dbError: string | null = null
  try {
    await prisma.$queryRaw`SELECT 1`
    dbConnects = true
  } catch (e) {
    dbError = (e as Error)?.message?.slice(0, 160) ?? 'unknown error'
  }

  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    dbConnects,
    dbError,
    env: {
      anthropic: present(process.env.ANTHROPIC_API_KEY),
      database: present(process.env.DATABASE_URL),
      authSecret: present(process.env.AUTH_SECRET),
      authUrl: present(process.env.AUTH_URL),
      googleId: present(process.env.AUTH_GOOGLE_ID),
      resend: present(process.env.RESEND_API_KEY),
    },
    anthropicVarNames: Object.keys(process.env).filter((k) => /anthrop/i.test(k)),
  })
}
