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

CREATE INDEX "MinistryTransferRequest_churchId_status_idx" ON "MinistryTransferRequest"("churchId", "status");
CREATE INDEX "MinistryTransferRequest_memberId_createdAt_idx" ON "MinistryTransferRequest"("memberId", "createdAt");
CREATE INDEX "MinistryTransferRequest_fromMinistryId_idx" ON "MinistryTransferRequest"("fromMinistryId");
CREATE INDEX "MinistryTransferRequest_toMinistryId_idx" ON "MinistryTransferRequest"("toMinistryId");

ALTER TABLE "MinistryTransferRequest"
ADD CONSTRAINT "MinistryTransferRequest_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistryTransferRequest"
ADD CONSTRAINT "MinistryTransferRequest_fromMinistryId_fkey"
FOREIGN KEY ("fromMinistryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MinistryTransferRequest"
ADD CONSTRAINT "MinistryTransferRequest_toMinistryId_fkey"
FOREIGN KEY ("toMinistryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MinistryTransferRequest"
ADD CONSTRAINT "MinistryTransferRequest_churchId_fkey"
FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
