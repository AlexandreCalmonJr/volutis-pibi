CREATE TABLE "FeedPost" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "mediaType" TEXT,
    "mediaUrl" TEXT,
    "linkUrl" TEXT,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "FeedComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HolyricsLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "payload" TEXT,
    "eventId" TEXT,
    "songId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "churchId" TEXT NOT NULL,

    CONSTRAINT "HolyricsLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedPost_churchId_createdAt_idx" ON "FeedPost"("churchId", "createdAt");
CREATE INDEX "FeedPost_memberId_createdAt_idx" ON "FeedPost"("memberId", "createdAt");
CREATE INDEX "FeedComment_postId_createdAt_idx" ON "FeedComment"("postId", "createdAt");
CREATE INDEX "FeedComment_memberId_createdAt_idx" ON "FeedComment"("memberId", "createdAt");
CREATE INDEX "HolyricsLog_churchId_createdAt_idx" ON "HolyricsLog"("churchId", "createdAt");
CREATE INDEX "HolyricsLog_eventId_createdAt_idx" ON "HolyricsLog"("eventId", "createdAt");
CREATE INDEX "HolyricsLog_songId_createdAt_idx" ON "HolyricsLog"("songId", "createdAt");

ALTER TABLE "FeedPost"
ADD CONSTRAINT "FeedPost_churchId_fkey"
FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedPost"
ADD CONSTRAINT "FeedPost_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedComment"
ADD CONSTRAINT "FeedComment_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedComment"
ADD CONSTRAINT "FeedComment_churchId_fkey"
FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedComment"
ADD CONSTRAINT "FeedComment_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HolyricsLog"
ADD CONSTRAINT "HolyricsLog_churchId_fkey"
FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
