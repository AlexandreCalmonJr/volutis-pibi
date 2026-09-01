-- AlterTable Church
ALTER TABLE "Church"
ADD COLUMN "youtubeChannelId" TEXT,
ADD COLUMN "youtubeApiKey" TEXT,
ADD COLUMN "youtubeAutoSchedule" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Event
ALTER TABLE "Event"
ADD COLUMN "bannerUrl" TEXT,
ADD COLUMN "theme" TEXT,
ADD COLUMN "preacher" TEXT,
ADD COLUMN "youtubeLiveId" TEXT,
ADD COLUMN "youtubeBroadcastUrl" TEXT,
ADD COLUMN "youtubeStreamKey" TEXT,
ADD COLUMN "youtubeStatus" TEXT DEFAULT 'NOT_SCHEDULED',
ADD COLUMN "youtubeScheduledAt" TIMESTAMP(3);

-- CreateTable EventMediaAsset
CREATE TABLE "EventMediaAsset" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "EventMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventMediaAsset_eventId_idx" ON "EventMediaAsset"("eventId");

-- AddForeignKey
ALTER TABLE "EventMediaAsset"
ADD CONSTRAINT "EventMediaAsset_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
