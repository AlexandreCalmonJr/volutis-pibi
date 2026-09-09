-- AlterTable: Adicionar campo de batismo na inscrição pública
ALTER TABLE "Application" ADD COLUMN "isBaptized" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Adicionar campos de registro de batismo no membro
ALTER TABLE "Member" ADD COLUMN "baptizedAt" TIMESTAMP(3);
ALTER TABLE "Member" ADD COLUMN "baptizedBy" TEXT;
