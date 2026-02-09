-- AlterTable
ALTER TABLE "store_funnels" ADD COLUMN "totalCustomers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "store_funnels" ADD COLUMN "returningCustomers" INTEGER NOT NULL DEFAULT 0;
