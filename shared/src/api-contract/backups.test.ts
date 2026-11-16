import { describe, expect, test } from 'vitest';
import { applyListQuery } from '../business-rules/lists--query';
import {
  BACKUP_RUN_LIST_DEFAULT_SORTING,
  BACKUP_RUN_LIST_FIELDS,
  RunBackupRequestSchema,
  backupRunExtraSearchText,
  backupRunStatusView,
  type BackupRun,
} from './backups';

/**
 * Một lần sao lưu mẫu, mỗi test sửa vài ô.
 * @param changes  các ô cần đổi
 * @returns        lần sao lưu
 */
function runOf(changes: Partial<BackupRun>): BackupRun {
  return {
    id: 'backup-run-1',
    startedAt: '2026-11-16T02:00:00',
    finishedAt: '2026-11-16T02:00:40',
    trigger: 'scheduled',
    startedBy: null,
    targetName: 'Trên máy chủ',
    targetKind: 'serverFolder',
    fileName: 'sao-luu-20261116-020000.tar.gz',
    sizeBytes: 50_000_000,
    status: 'ok',
    error: null,
    fileAvailable: true,
    pruned: false,
    ...changes,
  };
}

/** Lịch sử mẫu: định kì thành công, bản đã xóa vì quá số bản, Drive lỗi, Admin bấm tay. */
const RUNS: BackupRun[] = [
  runOf({ id: 'ok', startedAt: '2026-11-16T02:00:00' }),
  runOf({ id: 'pruned', startedAt: '2026-11-10T02:00:00', pruned: true, fileAvailable: false }),
  runOf({ id: 'drive-error', startedAt: '2026-11-15T02:00:00', targetName: 'Drive phòng', targetKind: 'googleDrive', status: 'error', sizeBytes: null, error: 'Google Drive từ chối truy cập' }),
  runOf({ id: 'manual', startedAt: '2026-11-15T14:32:00', trigger: 'manual', startedBy: { id: 'admin-1', name: 'Lê Văn Admin', email: 'admin@hcmulaw.edu.vn' }, targetName: 'Tải về máy', targetKind: 'download' }),
];

/**
 * Id các dòng của trang 1 (20 dòng) theo chữ tìm và bộ lọc.
 * @param search   chữ tìm
 * @param filters  điều kiện lọc
 * @returns        id các dòng
 */
function idsOf(search: string, filters: { fieldKey: string; operator: 'equals'; value: string }[] = []): string[] {
  const listQuery = { page: 1, pageSize: 20, search, sort: [], filters: filters.map((filter) => ({ ...filter, from: '', to: '' })) };
  return applyListQuery(RUNS, BACKUP_RUN_LIST_FIELDS, listQuery, BACKUP_RUN_LIST_DEFAULT_SORTING, backupRunExtraSearchText).rows.map((run) => run.id);
}

describe('RunBackupRequestSchema', () => {
  test('cần ít nhất một nơi lưu, không trùng', () => {
    expect(RunBackupRequestSchema.safeParse({ targetIds: ['a', 'b'] }).success).toBe(true);
    expect(RunBackupRequestSchema.safeParse({ targetIds: [] }).success).toBe(false);
    expect(RunBackupRequestSchema.safeParse({ targetIds: ['a', 'a'] }).success).toBe(false);
  });
});

describe('bảng lịch sử sao lưu', () => {
  test('thành công nhưng đã xóa vì quá số bản giữ thì tình trạng là pruned', () => {
    expect(backupRunStatusView({ status: 'ok', pruned: true })).toBe('pruned');
    expect(backupRunStatusView({ status: 'error', pruned: false })).toBe('error');
  });

  test('mặc định mới nhất trước', () => {
    expect(idsOf('')).toEqual(['ok', 'manual', 'drive-error', 'pruned']);
  });

  test('tìm được theo tên người bấm, câu lỗi, kiểu nơi lưu', () => {
    expect(idsOf('le van admin')).toEqual(['manual']);
    expect(idsOf('tu choi')).toEqual(['drive-error']);
    expect(idsOf('google drive')).toEqual(['drive-error']);
  });

  test('lọc theo tình trạng tách được bản đã xóa với bản thành công', () => {
    expect(idsOf('', [{ fieldKey: 'status', operator: 'equals', value: 'pruned' }])).toEqual(['pruned']);
    expect(idsOf('', [{ fieldKey: 'status', operator: 'equals', value: 'ok' }])).toEqual(['ok', 'manual']);
  });
});
