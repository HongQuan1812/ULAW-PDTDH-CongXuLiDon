-- CreateEnum
CREATE TYPE "FormEventAction" AS ENUM ('submit', 'edit', 'supplement', 'receive', 'requestSupplement', 'approve', 'reject', 'transfer');

-- CreateTable
CREATE TABLE "FormEvent" (
    "id" SERIAL NOT NULL,
    "formCode" TEXT NOT NULL,
    "action" "FormEventAction" NOT NULL,
    "status" "FormStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "toStaffId" TEXT,
    "at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FormEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormEvent_formCode_at_idx" ON "FormEvent"("formCode", "at");

-- AddForeignKey
ALTER TABLE "FormEvent" ADD CONSTRAINT "FormEvent_formCode_fkey" FOREIGN KEY ("formCode") REFERENCES "Form"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEvent" ADD CONSTRAINT "FormEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEvent" ADD CONSTRAINT "FormEvent_toStaffId_fkey" FOREIGN KEY ("toStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
