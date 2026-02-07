-- AlterTable: Add ad-level fields
ALTER TABLE "ad_metrics" ADD COLUMN "adId" TEXT;
ALTER TABLE "ad_metrics" ADD COLUMN "adName" TEXT;
ALTER TABLE "ad_metrics" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "ad_metrics" ADD COLUMN "reach" INTEGER NOT NULL DEFAULT 0;

-- Drop old unique constraint and create new one with adId
DROP INDEX IF EXISTS "ad_metrics_organizationId_platform_campaignId_date_key";
CREATE UNIQUE INDEX "ad_metrics_organizationId_platform_campaignId_adId_date_key" ON "ad_metrics"("organizationId", "platform", "campaignId", "adId", "date");
