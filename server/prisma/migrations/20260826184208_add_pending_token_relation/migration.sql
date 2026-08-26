-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VOLUNTEER',
    "churchId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingToken_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PendingToken" ("churchId", "createdAt", "email", "expiresAt", "id", "name", "phone", "role", "token", "usedAt") SELECT "churchId", "createdAt", "email", "expiresAt", "id", "name", "phone", "role", "token", "usedAt" FROM "PendingToken";
DROP TABLE "PendingToken";
ALTER TABLE "new_PendingToken" RENAME TO "PendingToken";
CREATE UNIQUE INDEX "PendingToken_token_key" ON "PendingToken"("token");
CREATE INDEX "PendingToken_token_idx" ON "PendingToken"("token");
CREATE INDEX "PendingToken_churchId_idx" ON "PendingToken"("churchId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
