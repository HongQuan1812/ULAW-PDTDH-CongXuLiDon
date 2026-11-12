-- CreateEnum
CREATE TYPE "Role" AS ENUM ('nguoiNopDon', 'nguoiXuLiDon', 'admin');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('nop', 'xet', 'bs', 'bsg', 'duyet', 'tc');

-- CreateEnum
CREATE TYPE "FormTypeStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateEnum
CREATE TYPE "FormEventAction" AS ENUM ('submit', 'edit', 'receive', 'supplement', 'approve', 'reject', 'transfer');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "cccd" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "mainStudentId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentInfo" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "className" TEXT,
    "trainingMode" TEXT,
    "major" TEXT NOT NULL,
    "currentCohort" TEXT,
    "originalCohort" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudentInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormType" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,

    CONSTRAINT "FormType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTypeVersion" (
    "formTypeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "FormTypeStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sections" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "FormTypeVersion_pkey" PRIMARY KEY ("formTypeId","version")
);

-- CreateTable
CREATE TABLE "Form" (
    "code" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "formTypeId" TEXT NOT NULL,
    "formTypeVersion" INTEGER NOT NULL,
    "status" "FormStatus" NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "decidedAt" TIMESTAMPTZ(3),
    "note" TEXT NOT NULL DEFAULT '',
    "receiverId" TEXT,
    "receivedAt" TIMESTAMPTZ(3),
    "handlerId" TEXT,
    "handlerSince" TIMESTAMPTZ(3),
    "answers" JSONB NOT NULL,
    "formTypeSnapshot" JSONB NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "FormEvent" (
    "id" SERIAL NOT NULL,
    "formCode" TEXT NOT NULL,
    "action" "FormEventAction" NOT NULL,
    "fromStatus" "FormStatus",
    "toStatus" "FormStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormCodeCounter" (
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FormCodeCounter_pkey" PRIMARY KEY ("prefix","year","version")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" TEXT NOT NULL,
    "formCode" TEXT,
    "name" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT,
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportTemplate" (
    "id" TEXT NOT NULL,
    "formTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "ExportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "EmailSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_cccd_key" ON "User"("cccd");

-- CreateIndex
CREATE UNIQUE INDEX "StudentInfo_studentId_key" ON "StudentInfo"("studentId");

-- CreateIndex
CREATE INDEX "StudentInfo_userId_idx" ON "StudentInfo"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FormType_prefix_key" ON "FormType"("prefix");

-- CreateIndex
CREATE INDEX "Form_ownerId_submittedAt_idx" ON "Form"("ownerId", "submittedAt");

-- CreateIndex
CREATE INDEX "Form_status_idx" ON "Form"("status");

-- CreateIndex
CREATE INDEX "Form_handlerId_idx" ON "Form"("handlerId");

-- CreateIndex
CREATE INDEX "FormEvent_formCode_at_idx" ON "FormEvent"("formCode", "at");

-- CreateIndex
CREATE INDEX "FileObject_formCode_idx" ON "FileObject"("formCode");

-- CreateIndex
CREATE INDEX "ExportTemplate_formTypeId_idx" ON "ExportTemplate"("formTypeId");

-- AddForeignKey
ALTER TABLE "StudentInfo" ADD CONSTRAINT "StudentInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTypeVersion" ADD CONSTRAINT "FormTypeVersion_formTypeId_fkey" FOREIGN KEY ("formTypeId") REFERENCES "FormType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTypeVersion" ADD CONSTRAINT "FormTypeVersion_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_formTypeId_fkey" FOREIGN KEY ("formTypeId") REFERENCES "FormType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_handlerId_fkey" FOREIGN KEY ("handlerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEvent" ADD CONSTRAINT "FormEvent_formCode_fkey" FOREIGN KEY ("formCode") REFERENCES "Form"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEvent" ADD CONSTRAINT "FormEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_formCode_fkey" FOREIGN KEY ("formCode") REFERENCES "Form"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportTemplate" ADD CONSTRAINT "ExportTemplate_formTypeId_fkey" FOREIGN KEY ("formTypeId") REFERENCES "FormType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportTemplate" ADD CONSTRAINT "ExportTemplate_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSettings" ADD CONSTRAINT "EmailSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
