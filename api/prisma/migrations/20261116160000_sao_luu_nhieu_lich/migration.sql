-- Sao lưu: lịch định kì thành danh sách (trước đây chỉ một dòng id = 1).
-- Dòng cũ giữ nguyên nội dung, đổi id thành 'backup-schedule-daily' (trùng id lịch mẫu).
ALTER TABLE "BackupSchedule" DROP CONSTRAINT "BackupSchedule_pkey",
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT USING (CASE WHEN "id" = 1 THEN 'backup-schedule-daily' ELSE 'backup-schedule-' || "id" END),
ADD CONSTRAINT "BackupSchedule_pkey" PRIMARY KEY ("id");
