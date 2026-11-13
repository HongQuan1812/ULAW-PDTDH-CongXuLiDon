-- CreateTable
CREATE TABLE "FormNote" (
    "id" TEXT NOT NULL,
    "formCode" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FormNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormNote_formCode_createdAt_idx" ON "FormNote"("formCode", "createdAt");

-- AddForeignKey
ALTER TABLE "FormNote" ADD CONSTRAINT "FormNote_formCode_fkey" FOREIGN KEY ("formCode") REFERENCES "Form"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormNote" ADD CONSTRAINT "FormNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
