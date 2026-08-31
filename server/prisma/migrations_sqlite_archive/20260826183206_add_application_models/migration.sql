-- AlterTable
ALTER TABLE "ScheduleItem" ADD COLUMN "reminderSentAt" DATETIME;

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "photoUrl" TEXT,
    "instruments" TEXT NOT NULL DEFAULT '[]',
    "availability" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'PUBLIC',
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT,
    CONSTRAINT "Application_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Application_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    CONSTRAINT "ApplicationPreference_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationPreference_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VOLUNTEER',
    "churchId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "photoUrl" TEXT,
    "instruments" TEXT NOT NULL DEFAULT '[]',
    "birthDate" DATETIME,
    "approvalStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    "userId" TEXT,
    "churchId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Member_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("birthDate", "churchId", "id", "instruments", "name", "phone", "photoUrl", "points", "userId") SELECT "birthDate", "churchId", "id", "instruments", "name", "phone", "photoUrl", "points", "userId" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_userId_key" ON "Member"("userId");
CREATE INDEX "Member_churchId_idx" ON "Member"("churchId");
CREATE INDEX "Member_approvalStatus_idx" ON "Member"("approvalStatus");
CREATE TABLE "new_SwapRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduleItemId" TEXT NOT NULL,
    "targetMemberId" TEXT,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "SwapRequest_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "ScheduleItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SwapRequest_targetMemberId_fkey" FOREIGN KEY ("targetMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SwapRequest" ("createdAt", "id", "message", "respondedAt", "scheduleItemId", "status", "targetMemberId") SELECT "createdAt", "id", "message", "respondedAt", "scheduleItemId", "status", "targetMemberId" FROM "SwapRequest";
DROP TABLE "SwapRequest";
ALTER TABLE "new_SwapRequest" RENAME TO "SwapRequest";
CREATE INDEX "SwapRequest_targetMemberId_idx" ON "SwapRequest"("targetMemberId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "firstLogin" BOOLEAN NOT NULL DEFAULT true,
    "lastPasswordReset" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "passwordHash", "role") SELECT "createdAt", "email", "id", "passwordHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Application_churchId_idx" ON "Application"("churchId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_memberId_idx" ON "Application"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationPreference_applicationId_ministryId_key" ON "ApplicationPreference"("applicationId", "ministryId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingToken_token_key" ON "PendingToken"("token");

-- CreateIndex
CREATE INDEX "PendingToken_token_idx" ON "PendingToken"("token");

-- CreateIndex
CREATE INDEX "PendingToken_churchId_idx" ON "PendingToken"("churchId");

-- CreateIndex
CREATE INDEX "Badge_memberId_idx" ON "Badge"("memberId");

-- CreateIndex
CREATE INDEX "ChatMessage_eventId_createdAt_idx" ON "ChatMessage"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_churchId_date_idx" ON "Event"("churchId", "date");

-- CreateIndex
CREATE INDEX "Event_startTime_idx" ON "Event"("startTime");

-- CreateIndex
CREATE INDEX "ScheduleItem_memberId_idx" ON "ScheduleItem"("memberId");

-- CreateIndex
CREATE INDEX "ScheduleItem_eventId_idx" ON "ScheduleItem"("eventId");

-- CreateIndex
CREATE INDEX "ScheduleItem_status_idx" ON "ScheduleItem"("status");
