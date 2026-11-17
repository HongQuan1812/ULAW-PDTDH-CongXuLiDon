/* Lệnh sao lưu trước khi cập nhật phiên bản mới: docker/deploy.sh chạy trong container api đang chạy (bản cũ), trước khi kéo image mới:
     docker exec ulaw-cong-xu-li-don-prod-api node dist/backups/backup-before-update.mjs
   Dùng đúng BackupsService của trang Sao lưu: một bản (database + uploads/) vào mọi nơi lưu kiểu thư mục máy chủ, giữ N bản,
   lịch sử ghi "Trước cập nhật". Không dựng cả ứng dụng NestJS: không bật lịch, không đụng các lần đang chạy của backend.
   Thoát 0: đã sao lưu xong, hoặc chưa có nơi lưu kiểu thư mục máy chủ (chỉ cảnh báo) · 1: có nơi lưu lỗi. */
import 'reflect-metadata';
import { PrismaService } from '../common/prisma.service';
import { AppConfig } from '../config/app-config';
import { loadDevEnvFile } from '../config/env-file';
import { BackupsService } from './backups.service';
import { GoogleDriveBackupService } from './google-drive-backup.service';

/**
 * Sao lưu trước cập nhật, in kết quả từng nơi lưu.
 * @returns  mã thoát: 0 thành công hoặc không có nơi lưu, 1 có nơi lưu lỗi
 */
async function backupBeforeUpdate(): Promise<number> {
  // Cấu hình, kết nối database như backend
  loadDevEnvFile();
  const config = new AppConfig();
  const prisma = new PrismaService(config);

  try {
    // Sao lưu, chờ xong
    const backups = new BackupsService(prisma, config, new GoogleDriveBackupService(config));
    const runs = await backups.runBeforeUpdate();
    if (!runs.length) {
      console.warn('Chưa có nơi lưu kiểu "Thư mục trên máy chủ" (trang Sao lưu), bỏ qua sao lưu trước cập nhật.');
      return 0;
    }

    // Mỗi nơi lưu một dòng kết quả
    for (const run of runs) {
      if (run.status === 'ok') console.log(`Sao lưu vào "${run.targetName}": ${run.fileName}`);
      else console.error(`Sao lưu vào "${run.targetName}" lỗi: ${run.error ?? ''}`);
    }
    return runs.every((run) => run.status === 'ok') ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

backupBeforeUpdate().then(
  (exitCode) => process.exit(exitCode),
  (error: unknown) => {
    console.error(`Sao lưu trước cập nhật lỗi: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
