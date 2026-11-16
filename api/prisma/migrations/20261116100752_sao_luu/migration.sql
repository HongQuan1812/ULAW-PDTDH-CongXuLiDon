-- CreateEnum
CREATE TYPE "BackupTargetKind" AS ENUM ('serverFolder', 'googleDrive');

-- CreateEnum
CREATE TYPE "BackupRunStatus" AS ENUM ('running', 'ok', 'error');

-- CreateEnum
CREATE TYPE "BackupRunTrigger" AS ENUM ('manual', 'scheduled');

-- CreateTable
CREATE TABLE "BackupTarget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "BackupTargetKind" NOT NULL,
    "folder" TEXT NOT NULL,
    "keepLatest" INTEGER NOT NULL,
    "googleAccount" TEXT,
    "googleRefreshToken" TEXT,
    "googleFolderId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupSchedule" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL,
    "frequency" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "targetIds" TEXT[],

    CONSTRAINT "BackupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3),
    "trigger" "BackupRunTrigger" NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3),
    "startedById" TEXT,
    "targetId" TEXT,
    "targetName" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "status" "BackupRunStatus" NOT NULL,
    "error" TEXT,
    "storagePath" TEXT,
    "driveFileId" TEXT,
    "pruned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackupTarget_kind_folder_key" ON "BackupTarget"("kind", "folder");

-- CreateIndex
CREATE INDEX "BackupRun_startedAt_idx" ON "BackupRun"("startedAt");

-- CreateIndex
CREATE INDEX "BackupRun_targetId_status_idx" ON "BackupRun"("targetId", "status");

-- AddForeignKey
ALTER TABLE "BackupRun" ADD CONSTRAINT "BackupRun_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupRun" ADD CONSTRAINT "BackupRun_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "BackupTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
