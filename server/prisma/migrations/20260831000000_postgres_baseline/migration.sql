-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Church" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "holyricsMode" TEXT,
    "holyricsLocalIp" TEXT,
    "holyricsLocalPort" INTEGER DEFAULT 8091,
    "holyricsToken" TEXT,
    "holyricsApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Church_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "firstLogin" BOOLEAN NOT NULL DEFAULT true,
    "lastPasswordReset" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VOLUNTEER',
    "createdByName" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "churchId" TEXT NOT NULL,
    "ministryId" TEXT,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "photoUrl" TEXT,
    "avatarKey" TEXT DEFAULT 'violet',
    "instruments" TEXT NOT NULL DEFAULT '[]',
    "birthDate" TIMESTAMP(3),
    "approvalStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "userId" TEXT,
    "churchId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ministry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "churchId" TEXT NOT NULL,

    CONSTRAINT "Ministry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,

    CONSTRAINT "MinistryRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryMember" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "roles" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "MinistryMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "isRecurrent" BOOLEAN NOT NULL DEFAULT false,
    "recurrence" TEXT,
    "churchId" TEXT NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "refusalReason" TEXT,
    "roleName" TEXT NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduleItemId" TEXT NOT NULL,
    "targetMemberId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unavailability" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "Unavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "scheduleItemId" TEXT NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "originalKey" TEXT,
    "bpm" INTEGER,
    "structure" TEXT,
    "youtubeUrl" TEXT,
    "spotifyUrl" TEXT,
    "cifraClubUrl" TEXT,
    "lyrics" TEXT,
    "chords" TEXT,
    "holyricsId" TEXT,
    "churchId" TEXT NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetlistItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "songKey" TEXT,
    "notes" TEXT,
    "songId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "SetlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiturgyItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TEXT,
    "durationMin" INTEGER,
    "responsible" TEXT,
    "bibleRef" TEXT,
    "notes" TEXT,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "LiturgyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "photoUrl" TEXT,
    "avatarKey" TEXT DEFAULT 'violet',
    "instruments" TEXT NOT NULL DEFAULT '[]',
    "availability" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'PUBLIC',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationPreference" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,

    CONSTRAINT "ApplicationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VOLUNTEER',
    "churchId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" TEXT,
    "whatsappLink" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryTransferRequest" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_SOURCE_LEADER',
    "mode" TEXT NOT NULL DEFAULT 'TRANSFER',
    "requestedRoles" TEXT NOT NULL DEFAULT '[]',
    "requestedLeader" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceLeaderApprovedAt" TIMESTAMP(3),
    "sourceLeaderApprovedBy" TEXT,
    "targetLeaderApprovedAt" TIMESTAMP(3),
    "targetLeaderApprovedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "memberId" TEXT NOT NULL,
    "fromMinistryId" TEXT,
    "toMinistryId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,

    CONSTRAINT "MinistryTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Church_slug_key" ON "Church"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Member_userId_key" ON "Member"("userId");

-- CreateIndex
CREATE INDEX "Member_churchId_idx" ON "Member"("churchId");

-- CreateIndex
CREATE INDEX "Member_approvalStatus_idx" ON "Member"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MinistryMember_memberId_ministryId_key" ON "MinistryMember"("memberId", "ministryId");

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

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleItem_eventId_memberId_roleName_key" ON "ScheduleItem"("eventId", "memberId", "roleName");

-- CreateIndex
CREATE INDEX "SwapRequest_targetMemberId_idx" ON "SwapRequest"("targetMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_scheduleItemId_key" ON "CheckIn"("scheduleItemId");

-- CreateIndex
CREATE INDEX "ChatMessage_eventId_createdAt_idx" ON "ChatMessage"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Badge_memberId_idx" ON "Badge"("memberId");

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
CREATE INDEX "UserNotification_memberId_createdAt_idx" ON "UserNotification"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "UserNotification_memberId_readAt_idx" ON "UserNotification"("memberId", "readAt");

-- CreateIndex
CREATE INDEX "MinistryTransferRequest_churchId_status_idx" ON "MinistryTransferRequest"("churchId", "status");

-- CreateIndex
CREATE INDEX "MinistryTransferRequest_memberId_createdAt_idx" ON "MinistryTransferRequest"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "MinistryTransferRequest_fromMinistryId_idx" ON "MinistryTransferRequest"("fromMinistryId");

-- CreateIndex
CREATE INDEX "MinistryTransferRequest_toMinistryId_idx" ON "MinistryTransferRequest"("toMinistryId");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryRole" ADD CONSTRAINT "MinistryRole_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMember" ADD CONSTRAINT "MinistryMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMember" ADD CONSTRAINT "MinistryMember_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "ScheduleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_targetMemberId_fkey" FOREIGN KEY ("targetMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unavailability" ADD CONSTRAINT "Unavailability_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "ScheduleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistItem" ADD CONSTRAINT "SetlistItem_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistItem" ADD CONSTRAINT "SetlistItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiturgyItem" ADD CONSTRAINT "LiturgyItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationPreference" ADD CONSTRAINT "ApplicationPreference_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationPreference" ADD CONSTRAINT "ApplicationPreference_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingToken" ADD CONSTRAINT "PendingToken_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTransferRequest" ADD CONSTRAINT "MinistryTransferRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTransferRequest" ADD CONSTRAINT "MinistryTransferRequest_fromMinistryId_fkey" FOREIGN KEY ("fromMinistryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTransferRequest" ADD CONSTRAINT "MinistryTransferRequest_toMinistryId_fkey" FOREIGN KEY ("toMinistryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryTransferRequest" ADD CONSTRAINT "MinistryTransferRequest_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

