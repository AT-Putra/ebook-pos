-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING_INITIAL_REVIEW', 'RUNNING', 'PENDING_FINAL_REVIEW', 'COMPLETED', 'DROPPED');

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startWindowDays" INTEGER NOT NULL DEFAULT 14,
    "durationDays" INTEGER NOT NULL DEFAULT 90,
    "finalProofWindowDays" INTEGER NOT NULL DEFAULT 14,
    "phases" JSONB NOT NULL,
    "videoMaxSeconds" INTEGER NOT NULL DEFAULT 30,
    "videoMaxSizeMb" INTEGER NOT NULL DEFAULT 10,
    "videoFormat" TEXT NOT NULL DEFAULT 'mp4',
    "rewardsText" TEXT,
    "winnerTiers" JSONB NOT NULL,
    "contactInfo" TEXT,
    "messageTemplates" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeParticipant" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'PENDING_INITIAL_REVIEW',
    "purchaseAt" TIMESTAMP(3) NOT NULL,
    "startAt" TIMESTAMP(3),
    "initialWeightKg" DOUBLE PRECISION,
    "finalSubmittedAt" TIMESTAMP(3),
    "finalWeightKg" DOUBLE PRECISION,
    "percentLoss" DOUBLE PRECISION,
    "dropReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeSubmission" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromNumber" TEXT NOT NULL,
    "wahaMessageId" TEXT,
    "mediaPath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "rawPayload" JSONB,

    CONSTRAINT "ChallengeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_productId_key" ON "Challenge"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipant_orderId_key" ON "ChallengeParticipant"("orderId");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_challengeId_status_idx" ON "ChallengeParticipant"("challengeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeSubmission_wahaMessageId_key" ON "ChallengeSubmission"("wahaMessageId");

-- CreateIndex
CREATE INDEX "ChallengeSubmission_participantId_idx" ON "ChallengeSubmission"("participantId");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeSubmission" ADD CONSTRAINT "ChallengeSubmission_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ChallengeParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
