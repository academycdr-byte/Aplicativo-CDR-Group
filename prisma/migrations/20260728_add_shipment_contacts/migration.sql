-- CreateTable: correções manuais dos dados de entrega, feitas no painel de Envios
CREATE TABLE IF NOT EXISTS "shipment_contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT,
    "document" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "shipment_contacts_orderId_key" ON "shipment_contacts"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "shipment_contacts_organizationId_idx" ON "shipment_contacts"("organizationId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shipment_contacts_organizationId_fkey'
    ) THEN
        ALTER TABLE "shipment_contacts"
            ADD CONSTRAINT "shipment_contacts_organizationId_fkey"
            FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
