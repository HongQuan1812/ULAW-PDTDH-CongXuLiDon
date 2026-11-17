import { describe, expect, test } from 'vitest';
import { BackupScheduleSchema, BackupTargetInputSchema, type BackupSchedule } from '../api-contract/backups';
import { backupFileName, isScheduledMinute, nextScheduledAt } from './backups--schedule';

/** Lịch hằng ngày 02:00, lưu vào một nơi. */
const daily: BackupSchedule = { enabled: true, frequency: 'daily', weekday: 1, time: '02:00', targetIds: ['t1'] };

describe('lịch sao lưu', () => {
  test('hằng ngày: chạy đúng giờ mỗi ngày; lần tới là hôm nay nếu chưa tới giờ, không thì ngày mai', () => {
    expect(isScheduledMinute(daily, '2026-11-16T02:00')).toBe(true);
    expect(isScheduledMinute(daily, '2026-11-16T02:01')).toBe(false);
    expect(nextScheduledAt(daily, '2026-11-16T01:59')).toBe('2026-11-16T02:00');
    expect(nextScheduledAt(daily, '2026-11-16T02:00')).toBe('2026-11-17T02:00');
  });

  test('hằng tuần: chỉ chạy đúng thứ (16/11/2026 là Thứ Hai); lần tới qua tuần sau nếu đã qua', () => {
    const weekly: BackupSchedule = { ...daily, frequency: 'weekly', weekday: 7, time: '23:30' };
    expect(isScheduledMinute(weekly, '2026-11-22T23:30')).toBe(true);
    expect(isScheduledMinute(weekly, '2026-11-21T23:30')).toBe(false);
    expect(nextScheduledAt(weekly, '2026-11-16T10:00')).toBe('2026-11-22T23:30');
    expect(nextScheduledAt(weekly, '2026-11-22T23:30')).toBe('2026-11-29T23:30');
  });

  test('lịch tắt hoặc chưa chọn nơi lưu: không chạy, không có lần tới', () => {
    for (const schedule of [{ ...daily, enabled: false }, { ...daily, targetIds: [] }]) {
      expect(isScheduledMinute(schedule, '2026-11-16T02:00')).toBe(false);
      expect(nextScheduledAt(schedule, '2026-11-16T01:00')).toBeNull();
    }
  });

  test('bật lịch phải chọn nơi lưu; giờ dạng HH:mm', () => {
    expect(BackupScheduleSchema.safeParse({ ...daily, targetIds: [] }).success).toBe(false);
    expect(BackupScheduleSchema.safeParse({ ...daily, enabled: false, targetIds: [] }).success).toBe(true);
    expect(BackupScheduleSchema.safeParse({ ...daily, time: '24:00' }).success).toBe(false);
  });
});

describe('nơi lưu, tên tệp', () => {
  test('thư mục trên máy chủ không ra ngoài BACKUP_DIR; tên thư mục Drive thì tự do', () => {
    const target = { name: 'Hằng ngày', kind: 'serverFolder', folder: 'hang-ngay/db', keepLatest: 7 } as const;
    expect(BackupTargetInputSchema.safeParse(target).success).toBe(true);
    for (const folder of ['../etc', '/abs', 'a//b', 'có dấu']) {
      expect(BackupTargetInputSchema.safeParse({ ...target, folder }).success).toBe(false);
    }
    expect(BackupTargetInputSchema.safeParse({ ...target, kind: 'googleDrive', folder: 'Sao lưu cổng', driveFolderId: '1AbC' }).success).toBe(true);
  });

  test('tên tệp theo lúc bắt đầu', () => {
    expect(backupFileName('2026-11-16T09:30:05')).toBe('sao-luu-20261116-093005.tar.gz');
  });
});
