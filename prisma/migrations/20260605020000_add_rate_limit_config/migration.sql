-- CreateTable
CREATE TABLE "RateLimitConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRequests" INTEGER NOT NULL DEFAULT 10,
    "windowSeconds" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitConfig_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton config row.
INSERT INTO "RateLimitConfig" ("id", "enabled", "maxRequests", "windowSeconds", "updatedAt")
VALUES ('default', true, 10, 60, CURRENT_TIMESTAMP);
