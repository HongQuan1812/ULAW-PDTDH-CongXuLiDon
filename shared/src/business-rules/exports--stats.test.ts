import { describe, expect, test } from 'vitest';
import { ExportStatsRequestSchema } from '../api-contract/exports';
import { selectStatsForms, statsSheetName } from './exports--stats';

/** Đơn thử: phiên bản và lúc nộp (giờ Việt Nam). */
const forms = [
  { code: 'A', version: 1, submittedAt: '2026-01-31T23:59' },
  { code: 'B', version: 1, submittedAt: '2026-02-01T00:00' },
  { code: 'C', version: 2, submittedAt: '2026-02-15T10:30' },
  { code: 'D', version: 2, submittedAt: '2026-03-01T08:00' },
];

const codesOf = (selected: typeof forms) => selected.map((form) => form.code);

describe('selectStatsForms', () => {
  test('"all" không lọc ngày thì lấy mọi đơn, giữ thứ tự', () => {
    expect(codesOf(selectStatsForms(forms, { version: 'all', submittedFrom: null, submittedTo: null }))).toEqual(['A', 'B', 'C', 'D']);
  });

  test('chọn một phiên bản thì chỉ lấy đơn của phiên bản đó', () => {
    expect(codesOf(selectStatsForms(forms, { version: 2, submittedFrom: null, submittedTo: null }))).toEqual(['C', 'D']);
  });

  test('lọc theo ngày nộp, tính cả ngày đầu và ngày cuối', () => {
    expect(codesOf(selectStatsForms(forms, { version: 'all', submittedFrom: '2026-02-01', submittedTo: '2026-02-15' }))).toEqual(['B', 'C']);
  });

  test('chỉ có ngày bắt đầu hoặc chỉ có ngày kết thúc', () => {
    expect(codesOf(selectStatsForms(forms, { version: 'all', submittedFrom: '2026-02-15', submittedTo: null }))).toEqual(['C', 'D']);
    expect(codesOf(selectStatsForms(forms, { version: 'all', submittedFrom: null, submittedTo: '2026-01-31' }))).toEqual(['A']);
  });

  test('kết hợp phiên bản và ngày', () => {
    expect(codesOf(selectStatsForms(forms, { version: 1, submittedFrom: '2026-02-01', submittedTo: null }))).toEqual(['B']);
  });
});

describe('statsSheetName', () => {
  test('tên sheet của một phiên bản', () => {
    expect(statsSheetName(3)).toBe('Phiên bản 3');
  });
});

describe('ExportStatsRequestSchema', () => {
  test('nhận số phiên bản hoặc "all", ngày dạng YYYY-MM-DD hoặc null', () => {
    expect(ExportStatsRequestSchema.safeParse({ version: 'all', submittedFrom: null, submittedTo: null }).success).toBe(true);
    expect(ExportStatsRequestSchema.safeParse({ version: 2, submittedFrom: '2026-02-01', submittedTo: '2026-02-28' }).success).toBe(true);
  });

  test('từ chối phiên bản sai, ngày sai dạng, ngày bắt đầu sau ngày kết thúc', () => {
    expect(ExportStatsRequestSchema.safeParse({ version: 0, submittedFrom: null, submittedTo: null }).success).toBe(false);
    expect(ExportStatsRequestSchema.safeParse({ version: 'x', submittedFrom: null, submittedTo: null }).success).toBe(false);
    expect(ExportStatsRequestSchema.safeParse({ version: 1, submittedFrom: '01/02/2026', submittedTo: null }).success).toBe(false);
    expect(ExportStatsRequestSchema.safeParse({ version: 1, submittedFrom: '2026-03-01', submittedTo: '2026-02-01' }).success).toBe(false);
  });
});
