import { describe, expect, it } from 'vitest';
import type { ListQuery } from '../aux-schema/lists';
import { applyListQuery, filterOptionsOf, filterRows, sortRows, type TableField } from './lists--query';

/* Dữ liệu thử: một bảng đơn nhỏ, có ô trống ở cột số tín chỉ và cột người xử lí. */
interface TestRow {
  code: string;
  status: 'nop' | 'xet' | 'duyet';
  submittedAt: string;
  credits: number | null;
  handler: { id: string; name: string } | null;
  fullCccd: string;
}
const STATUS_LABELS = { nop: 'Đã nộp', xet: 'Đang xét', duyet: 'Đã duyệt' } as const;
const FIELDS: TableField<TestRow>[] = [
  { key: 'code', label: 'Mã đơn', type: 'text', getValue: (row) => row.code },
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    getValue: (row) => row.status,
    getLabel: (row) => STATUS_LABELS[row.status],
    options: [{ value: 'nop', label: 'Đã nộp' }],
  },
  { key: 'submittedAt', label: 'Ngày nộp', type: 'date', getValue: (row) => row.submittedAt },
  { key: 'credits', label: 'Số tín chỉ', type: 'number', getValue: (row) => row.credits },
  { key: 'handler', label: 'Người xử lí', type: 'select', getValue: (row) => row.handler?.id ?? null, getLabel: (row) => row.handler?.name ?? '' },
];
const ROWS: TestRow[] = [
  { code: 'A-2', status: 'xet', submittedAt: '2026-10-30T07:00', credits: 3, handler: { id: 'cb-1', name: 'Lê Ngọc Diệp' }, fullCccd: '079100000001' },
  { code: 'A-10', status: 'nop', submittedAt: '2026-10-12T09:30', credits: null, handler: null, fullCccd: '079100000002' },
  { code: 'A-1', status: 'duyet', submittedAt: '2026-09-01T08:15', credits: 2, handler: { id: 'cb-1', name: 'Lê Ngọc Diệp' }, fullCccd: '079100000003' },
  { code: 'A-3', status: 'xet', submittedAt: '2026-10-30T07:00', credits: 3, handler: { id: 'cb-2', name: 'Trần Việt Anh' }, fullCccd: '079100000004' },
];

/**
 * Mã đơn của các dòng, để so sánh kết quả cho gọn.
 * @param rows  các dòng
 * @returns     mã đơn theo thứ tự
 */
const codesOf = (rows: readonly TestRow[]) => rows.map((row) => row.code);

/**
 * Một lần hỏi trang, mặc định trang 1, 2 dòng mỗi trang, không tìm, không xếp, không lọc.
 * @param changes  phần khác mặc định
 * @returns        lần hỏi trang
 */
const listQueryOf = (changes: Partial<ListQuery>): ListQuery => ({ page: 1, pageSize: 2, search: '', sort: [], filters: [], ...changes });

describe('sortRows', () => {
  it('xếp nhiều cột: cột đầu trước, bằng nhau thì xét cột sau; số trong chữ so theo giá trị', () => {
    expect(codesOf(sortRows(ROWS, FIELDS, [{ id: 'code', desc: false }]))).toEqual(['A-1', 'A-2', 'A-3', 'A-10']);
    expect(codesOf(sortRows(ROWS, FIELDS, [{ id: 'submittedAt', desc: true }, { id: 'code', desc: true }]))).toEqual(['A-3', 'A-2', 'A-10', 'A-1']);
  });

  it('ô trống luôn nằm cuối dù xếp chiều nào', () => {
    expect(codesOf(sortRows(ROWS, FIELDS, [{ id: 'credits', desc: false }])).at(-1)).toBe('A-10');
    expect(codesOf(sortRows(ROWS, FIELDS, [{ id: 'credits', desc: true }])).at(-1)).toBe('A-10');
  });
});

describe('filterRows', () => {
  it('tìm được theo chữ thêm (không hiện trong ô), vd CCCD đầy đủ', () => {
    expect(filterRows(ROWS, FIELDS, '079100000004', [])).toEqual([]);
    expect(codesOf(filterRows(ROWS, FIELDS, '079100000004', [], (row) => [row.fullCccd]))).toEqual(['A-3']);
  });
});

describe('filterOptionsOf', () => {
  it('chỉ lấy lựa chọn của cột select không có lựa chọn cố định, mỗi giá trị một lần', () => {
    expect(filterOptionsOf(FIELDS, ROWS)).toEqual({
      handler: [
        { value: 'cb-1', label: 'Lê Ngọc Diệp' },
        { value: 'cb-2', label: 'Trần Việt Anh' },
      ],
    });
  });
});

describe('applyListQuery', () => {
  const defaultSorting = [{ id: 'submittedAt', desc: true }, { id: 'code', desc: true }];

  it('trả đúng trang theo thứ tự mặc định, kèm tổng số dòng khớp', () => {
    const secondPage = applyListQuery(ROWS, FIELDS, listQueryOf({ page: 2 }), defaultSorting);
    expect(codesOf(secondPage.rows)).toEqual(['A-10', 'A-1']);
    expect(secondPage.total).toBe(4);
    expect(secondPage.page).toBe(2);
  });

  it('tìm, lọc trước rồi mới chia trang; lựa chọn lọc lấy trên mọi dòng, không theo bộ lọc', () => {
    const filtered = applyListQuery(
      ROWS,
      FIELDS,
      listQueryOf({ search: 'dang xet', filters: [{ fieldKey: 'handler', operator: 'equals', value: 'cb-2', from: '', to: '' }] }),
      defaultSorting,
    );
    expect(codesOf(filtered.rows)).toEqual(['A-3']);
    expect(filtered.total).toBe(1);
    expect(filtered.filterOptions.handler).toHaveLength(2);
  });

  it('hỏi quá trang cuối thì trả trang cuối; không có dòng nào thì trang 1', () => {
    expect(applyListQuery(ROWS, FIELDS, listQueryOf({ page: 9 }), defaultSorting).page).toBe(2);
    const empty = applyListQuery(ROWS, FIELDS, listQueryOf({ page: 3, search: 'không có' }), defaultSorting);
    expect(empty).toMatchObject({ rows: [], total: 0, page: 1 });
  });
});
