-- D17 (§26): server-to-server conversion postback to an ad publisher on PAID.
-- Order gains best-effort/idempotent postback audit fields; new singleton config table.
ALTER TABLE "Order" ADD COLUMN "conversionPostbackSentAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "conversionPostbackError" TEXT;
ALTER TABLE "Order" ADD COLUMN "conversionPostbackAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ConversionConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "postbackUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ConversionConfig" ("id", "enabled", "postbackUrl", "updatedAt")
VALUES ('default', false, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
