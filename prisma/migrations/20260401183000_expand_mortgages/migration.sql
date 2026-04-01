-- AlterTable
ALTER TABLE "Mortgage" ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "Mortgage" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'amortizing';
