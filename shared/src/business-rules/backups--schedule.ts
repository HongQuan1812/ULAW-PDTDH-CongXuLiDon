/* Luật của tính năng sao lưu: lịch định kì chạy lúc nào, tên tệp sao lưu. Giờ đều là giờ Việt Nam, dạng chữ 'YYYY-MM-DDTHH:mm…'.
   API giả và backend cùng dùng. */
import type { BackupSchedule } from '../api-contract/backups';

/**
 * Thứ trong tuần của một ngày, 1 = Thứ Hai … 7 = Chủ nhật.
 * @param date  ngày 'YYYY-MM-DD'
 * @returns     1…7
 */
function weekdayOf(date: string): number {
  const sundayFirst = new Date(`${date}T00:00:00Z`).getUTCDay();
  return sundayFirst === 0 ? 7 : sundayFirst;
}

/**
 * Cộng thêm số ngày vào một ngày.
 * @param date  ngày 'YYYY-MM-DD'
 * @param days  số ngày
 * @returns     ngày 'YYYY-MM-DD'
 */
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Ngày này có chạy theo lịch không (chưa xét giờ).
 * @param schedule  lịch
 * @param date      ngày 'YYYY-MM-DD'
 * @returns         hằng ngày: luôn có · hằng tuần: đúng thứ
 */
function runsOn(schedule: Pick<BackupSchedule, 'frequency' | 'weekday'>, date: string): boolean {
  return schedule.frequency === 'daily' || weekdayOf(date) === schedule.weekday;
}

/**
 * Phút này có phải lúc chạy theo lịch không. Máy chủ kiểm mỗi phút.
 * @param schedule  lịch
 * @param minute    phút đang xét, giờ Việt Nam 'YYYY-MM-DDTHH:mm' (phần giây trở đi bỏ qua)
 * @returns         true khi lịch đang bật, có nơi lưu, đúng ngày và đúng giờ
 */
export function isScheduledMinute(schedule: BackupSchedule, minute: string): boolean {
  if (!schedule.enabled || !schedule.targetIds.length) return false;
  return minute.slice(11, 16) === schedule.time && runsOn(schedule, minute.slice(0, 10));
}

/**
 * Lần chạy định kì tới, tính từ một lúc (không tính chính phút đó).
 * @param schedule  lịch
 * @param now       lúc tính, giờ Việt Nam 'YYYY-MM-DDTHH:mm'
 * @returns         'YYYY-MM-DDTHH:mm'; null khi lịch tắt hoặc chưa chọn nơi lưu
 */
export function nextScheduledAt(schedule: BackupSchedule, now: string): string | null {
  if (!schedule.enabled || !schedule.targetIds.length) return null;

  // Xét từ hôm nay tới 7 ngày sau: ngày đầu tiên có chạy mà giờ chạy còn sau lúc này
  const today = now.slice(0, 10);
  for (let days = 0; days <= 7; days++) {
    const date = addDays(today, days);
    const at = `${date}T${schedule.time}`;
    if (runsOn(schedule, date) && at > now.slice(0, 16)) return at;
  }
  return null;
}

/**
 * Tên tệp sao lưu theo lúc bắt đầu.
 * @param startedAt  giờ Việt Nam 'YYYY-MM-DDTHH:mm:ss'
 * @returns          vd 'sao-luu-20261116-093000.tar.gz'
 */
export function backupFileName(startedAt: string): string {
  const digits = startedAt.replace(/\D/g, '');
  return `sao-luu-${digits.slice(0, 8)}-${digits.slice(8, 14).padEnd(6, '0')}.tar.gz`;
}
