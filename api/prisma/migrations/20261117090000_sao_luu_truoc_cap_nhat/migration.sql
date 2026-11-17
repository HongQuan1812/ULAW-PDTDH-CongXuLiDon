-- Lần sao lưu tự chạy trước khi cập nhật phiên bản mới (docker/deploy.sh)
ALTER TYPE "BackupRunTrigger" ADD VALUE 'beforeUpdate';
