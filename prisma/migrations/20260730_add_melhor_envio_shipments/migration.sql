-- CreateTable: registro de que um pedido ja foi mandado pro carrinho do
-- Melhor Envio, pra nao depender so do estado local da tela (que se perde
-- num reload) nem so da consulta ao vivo no carrinho (que falha assim que
-- o item sai de la, ex. depois de pago/impresso).
CREATE TABLE IF NOT EXISTS "melhor_envio_shipments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "protocolo" TEXT,
    "servico" TEXT NOT NULL,
    "transportadora" TEXT,
    "preco" DECIMAL(10,2) NOT NULL,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "melhor_envio_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "melhor_envio_shipments_orderId_key" ON "melhor_envio_shipments"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "melhor_envio_shipments_organizationId_idx" ON "melhor_envio_shipments"("organizationId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'melhor_envio_shipments_organizationId_fkey'
    ) THEN
        ALTER TABLE "melhor_envio_shipments"
            ADD CONSTRAINT "melhor_envio_shipments_organizationId_fkey"
            FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
