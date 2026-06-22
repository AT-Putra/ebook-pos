-- Email fallback delivery (slice D14, §23):
-- when a WhatsApp delivery item fails, the e-book + attachments are also emailed to the buyer.
-- Idempotent (once per order) via emailFallbackSentAt.
ALTER TABLE "Delivery" ADD COLUMN     "emailFallbackSentAt" TIMESTAMP(3);
ALTER TABLE "Delivery" ADD COLUMN     "emailFallbackError" TEXT;
ALTER TABLE "Delivery" ADD COLUMN     "emailFallbackAttempts" INTEGER NOT NULL DEFAULT 0;
