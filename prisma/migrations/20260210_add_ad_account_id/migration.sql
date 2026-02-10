-- Add accountId to ad_metrics for multi-account filtering
ALTER TABLE "ad_metrics" ADD COLUMN IF NOT EXISTS "accountId" TEXT;

-- Add index for efficient filtering by account
CREATE INDEX IF NOT EXISTS "ad_metrics_accountId_idx" ON "ad_metrics" ("organizationId", "accountId");
