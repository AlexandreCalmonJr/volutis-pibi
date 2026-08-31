CREATE TABLE "SchedulerLease" (
    "key" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerLease_pkey" PRIMARY KEY ("key")
);
