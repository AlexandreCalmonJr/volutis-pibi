-- AlterTable
ALTER TABLE "Member" ADD COLUMN "bannerUrl" TEXT;
ALTER TABLE "Member" ADD COLUMN "isHelpdesk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "helpdeskRole" TEXT;
