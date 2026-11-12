/*
  Warnings:

  - You are about to drop the `FormEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FormEvent" DROP CONSTRAINT "FormEvent_actorId_fkey";

-- DropForeignKey
ALTER TABLE "FormEvent" DROP CONSTRAINT "FormEvent_formCode_fkey";

-- DropTable
DROP TABLE "FormEvent";

-- DropEnum
DROP TYPE "FormEventAction";
