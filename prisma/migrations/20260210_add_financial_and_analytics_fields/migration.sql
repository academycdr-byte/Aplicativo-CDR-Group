-- AlterTable: Add new financial config fields
ALTER TABLE "financial_configs" ADD COLUMN IF NOT EXISTS "gatewayRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "financial_configs" ADD COLUMN IF NOT EXISTS "checkoutRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "financial_configs" ADD COLUMN IF NOT EXISTS "taxBase" TEXT NOT NULL DEFAULT 'revenue';
ALTER TABLE "financial_configs" ADD COLUMN IF NOT EXISTS "fixedCosts" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "financial_configs" ADD COLUMN IF NOT EXISTS "chargebackRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable: Add gender and age breakdown columns to analytics_metrics
ALTER TABLE "analytics_metrics" ADD COLUMN IF NOT EXISTS "gender" JSONB;
ALTER TABLE "analytics_metrics" ADD COLUMN IF NOT EXISTS "age" JSONB;
