import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Allow long runs so the ?sleep diagnostic can test the real function limit.
export const maxDuration = 60

// Reports env-var presence (booleans only, never values), DB connectivity, and
// supports ?sleep=N to test whether the deployment can run longer than the
// default ~10s cap (i.e. whether Fluid Compute is actually active).
export async function GET(req: Request) {
  const sleep = Math.min(parseInt(new URL(req.url).searchParams.get('sleep') ?? '0', 10) || 0, 55)
  const started = Date.now()
  if (sleep > 0) await new Promise((r) => setTimeout(r, sleep * 1000))

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
    sleptMs: Date.now() - started,
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
