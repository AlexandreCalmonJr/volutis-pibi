-- AlterTable Ministry
ALTER TABLE "Ministry" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable Event
ALTER TABLE "Event" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "details" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "churchId" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ministry_churchId_idx" ON "Ministry"("churchId");

-- CreateIndex
CREATE INDEX "Ministry_deletedAt_idx" ON "Ministry"("deletedAt");

-- CreateIndex
CREATE INDEX "Event_deletedAt_idx" ON "Event"("deletedAt");

-- CreateIndex
CREATE INDEX "ScheduleItem_memberId_status_idx" ON "ScheduleItem"("memberId", "status");

-- CreateIndex
CREATE INDEX "ScheduleItem_eventId_status_idx" ON "ScheduleItem"("eventId", "status");

-- CreateIndex
CREATE INDEX "ScheduleItem_reminderSentAt_idx" ON "ScheduleItem"("reminderSentAt");

-- CreateIndex
CREATE INDEX "UserNotification_memberId_readAt_createdAt_idx" ON "UserNotification"("memberId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_churchId_createdAt_idx" ON "AuditLog"("churchId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
