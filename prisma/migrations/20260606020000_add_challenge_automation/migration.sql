-- AlterEnum: pre-start status for buyers auto-created on PAID (D12)
ALTER TYPE "ParticipantStatus" ADD VALUE 'AWAITING_INITIAL' BEFORE 'PENDING_INITIAL_REVIEW';

-- CreateTable: idempotency log for sent challenge reminders
CREATE TABLE "ChallengeReminderLog" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wahaMessageId" TEXT,
    "error" TEXT,

    CONSTRAINT "ChallengeReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeReminderLog_participantId_key_key" ON "ChallengeReminderLog"("participantId", "key");

-- AddForeignKey
ALTER TABLE "ChallengeReminderLog" ADD CONSTRAINT "ChallengeReminderLog_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ChallengeParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
