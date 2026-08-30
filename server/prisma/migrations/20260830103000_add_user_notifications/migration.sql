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

CREATE INDEX "UserNotification_memberId_createdAt_idx" ON "UserNotification"("memberId", "createdAt");
CREATE INDEX "UserNotification_memberId_readAt_idx" ON "UserNotification"("memberId", "readAt");

ALTER TABLE "UserNotification"
ADD CONSTRAINT "UserNotification_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
