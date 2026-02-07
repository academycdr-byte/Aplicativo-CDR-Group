-- CreateTable
CREATE TABLE "store_funnels" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "date" DATE NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "addToCart" INTEGER NOT NULL DEFAULT 0,
    "checkoutsInitiated" INTEGER NOT NULL DEFAULT 0,
    "ordersGenerated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_funnels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_funnels_organizationId_platform_date_key" ON "store_funnels"("organizationId", "platform", "date");

-- CreateIndex
CREATE INDEX "store_funnels_organizationId_date_idx" ON "store_funnels"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "store_funnels" ADD CONSTRAINT "store_funnels_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
