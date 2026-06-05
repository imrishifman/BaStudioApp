-- Marketing emails migration.
-- Apply once in Supabase SQL editor. Idempotent: re-running is a no-op.

-- Per-user marketing opt-in + opaque unsubscribe token.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "marketingEmailOptIn" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_unsubscribeToken_key"
  ON "User"("unsubscribeToken");

-- Campaign queue. Cron picks the oldest DRAFT, sends, marks SENT.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MarketingEmailCampaignStatus') THEN
    CREATE TYPE "MarketingEmailCampaignStatus" AS ENUM ('DRAFT', 'SENT');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "MarketingEmailCampaign" (
  "id"              TEXT PRIMARY KEY,
  "subject"         TEXT NOT NULL,
  "html"            TEXT NOT NULL,
  "preheader"       TEXT,
  "status"          "MarketingEmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "sentAt"          TIMESTAMP(3),
  "sentCount"       INTEGER NOT NULL DEFAULT 0,
  "createdByEmail"  TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);

-- Useful index for the cron's "oldest DRAFT" query.
CREATE INDEX IF NOT EXISTS "MarketingEmailCampaign_status_createdAt_idx"
  ON "MarketingEmailCampaign"("status", "createdAt");
