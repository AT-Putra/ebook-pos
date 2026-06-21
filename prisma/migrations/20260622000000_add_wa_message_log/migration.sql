-- CreateEnum
CREATE TYPE "WaLogStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable: immutable audit log of outbound WhatsApp sends (WA Logs, slice D5)
CREATE TABLE "WaMessageLog" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "WaLogStatus" NOT NULL,
    "chatId" TEXT NOT NULL,
    "toPhone" TEXT,
    "templateKey" TEXT,
    "fileName" TEXT,
    "bodyPreview" TEXT,
    "wahaMessageId" TEXT,
    "error" TEXT,
    "orderId" TEXT,
    "deliveryId" TEXT,
    "deliveryItemId" TEXT,
    "participantId" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaMessageLog_createdAt_idx" ON "WaMessageLog"("createdAt");

-- CreateIndex
CREATE INDEX "WaMessageLog_category_status_idx" ON "WaMessageLog"("category", "status");

-- CreateIndex
CREATE INDEX "WaMessageLog_productId_idx" ON "WaMessageLog"("productId");
