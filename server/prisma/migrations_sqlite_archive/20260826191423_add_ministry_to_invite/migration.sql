-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VOLUNTEER',
    "createdByName" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedByEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "churchId" TEXT NOT NULL,
    "ministryId" TEXT,
    CONSTRAINT "Invite_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invite_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invite" ("churchId", "code", "createdAt", "createdByName", "expiresAt", "id", "role", "usedAt", "usedByEmail") SELECT "churchId", "code", "createdAt", "createdByName", "expiresAt", "id", "role", "usedAt", "usedByEmail" FROM "Invite";
DROP TABLE "Invite";
ALTER TABLE "new_Invite" RENAME TO "Invite";
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
