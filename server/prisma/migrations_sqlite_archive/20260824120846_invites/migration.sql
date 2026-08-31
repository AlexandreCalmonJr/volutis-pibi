-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VOLUNTEER',
    "createdByName" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedByEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "churchId" TEXT NOT NULL,
    CONSTRAINT "Invite_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");
