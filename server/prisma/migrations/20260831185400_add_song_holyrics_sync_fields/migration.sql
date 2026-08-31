ALTER TABLE "Song"
ADD COLUMN "holyricsSyncStatus" TEXT,
ADD COLUMN "holyricsSyncError" TEXT,
ADD COLUMN "holyricsLastSyncAt" TIMESTAMP(3);
