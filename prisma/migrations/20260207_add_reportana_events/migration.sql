-- CreateTable
CREATE TABLE "reportana_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "lineItems" JSONB,
    "rawData" JSONB,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportana_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reportana_events_organizationId_eventType_idx" ON "reportana_events"("organizationId", "eventType");

-- CreateIndex
CREATE INDEX "reportana_events_organizationId_eventDate_idx" ON "reportana_events"("organizationId", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "reportana_events_organizationId_eventType_referenceId_key" ON "reportana_events"("organizationId", "eventType", "referenceId");

-- AddForeignKey
ALTER TABLE "reportana_events" ADD CONSTRAINT "reportana_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
