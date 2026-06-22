-- CreateTable: MessagingConfig (singleton — active WhatsApp engine selector, slice D15 §24)
CREATE TABLE "MessagingConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "engine" TEXT NOT NULL DEFAULT 'waha',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingConfig_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so the default engine (WAHA) is active out of the box.
INSERT INTO "MessagingConfig" ("id", "engine", "updatedAt")
VALUES ('default', 'waha', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
