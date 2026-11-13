-- CreateEnum
CREATE TYPE "ExportTemplatePurpose" AS ENUM ('form', 'stats');

-- AlterTable
ALTER TABLE "ExportTemplate" ADD COLUMN     "purpose" "ExportTemplatePurpose" NOT NULL DEFAULT 'form';
