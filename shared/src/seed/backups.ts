/* Sao lưu mẫu: một nơi lưu trên máy chủ và lịch hằng ngày lưu vào đó. Chưa có lần sao lưu nào.
   API giả và seed của backend cùng dùng; seed bản thật (seed:production) cũng thêm đúng bộ này khi chưa có. */
import type { BackupScheduleItem, BackupTargetInput } from '../api-contract/backups';

/** Nơi lưu ban đầu (id cố định để lịch trỏ tới). */
export const BACKUP_TARGETS_SEED: readonly (BackupTargetInput & { id: string })[] = [
  { id: 'backup-target-server', name: 'Trên máy chủ', kind: 'serverFolder', folder: 'hang-ngay', keepLatest: 14 },
];

/** Lịch ban đầu: một lịch 02:00 hằng ngày, lưu vào thư mục trên máy chủ. Tắt sẵn: Admin tự bật khi muốn sao lưu định kì. */
export const BACKUP_SCHEDULES_SEED: readonly BackupScheduleItem[] = [
  { id: 'backup-schedule-daily', enabled: false, frequency: 'daily', weekday: 1, time: '02:00', targetIds: ['backup-target-server'] },
];
