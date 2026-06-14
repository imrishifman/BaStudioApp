-- Social posting (Instagram auto-poster) migration.
-- Apply once in the Supabase SQL editor. Idempotent: re-running is a no-op.

-- Rotating access token for a social provider (one row per provider).
CREATE TABLE IF NOT EXISTS "SocialToken" (
  "id"          TEXT NOT NULL,
  "provider"    TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3),
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialToken_provider_key"
  ON "SocialToken"("provider");

-- Post status enum.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SocialPostStatus') THEN
    CREATE TYPE "SocialPostStatus" AS ENUM (
      'draft', 'pending_approval', 'approved',
      'publishing', 'published', 'failed', 'rejected'
    );
  END IF;
END $$;

-- One row per social post moving through the pipeline.
CREATE TABLE IF NOT EXISTS "SocialPost" (
  "id"           TEXT NOT NULL,
  "status"       "SocialPostStatus" NOT NULL DEFAULT 'draft',
  "caption"      TEXT NOT NULL,
  "hashtags"     TEXT,
  "imageUrl"     TEXT,
  "mediaType"    TEXT NOT NULL DEFAULT 'IMAGE',
  "igMediaId"    TEXT,
  "permalink"    TEXT,
  "fbPostId"     TEXT,
  "error"        TEXT,
  "scheduledFor" TIMESTAMP(3),
  "approvedAt"   TIMESTAMP(3),
  "publishedAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SocialPost_status_idx"
  ON "SocialPost"("status");
