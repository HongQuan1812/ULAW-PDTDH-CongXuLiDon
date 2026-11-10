import { describe, expect, it } from 'vitest';
import { createTable, getCoreRowModel, getSortedRowModel, type SortingState } from '@tanstack/react-table';
import { buildColumns } from './useTableTools';
import {
  createFilterRule,
  displayText,
  equalsFilterValue,
  filterRows,
  isFilterActive,
  selectOptions,
  toggleEqualsFilter,
  type FilterRule,
  type TableField,
} from './tableTools';

/* Dữ liệu thử: một bảng đơn nhỏ, có ô trống ở cột số tín chỉ. */
interface TestRow {
  code: string;
  status: 'nop' | 'xet' | 'duyet';
  submittedAt: string;
  credits: number | null;
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
  },
  { key: 'submittedAt', label: 'Ngày nộp', type: 'date', getValue: (row) => row.submittedAt },
  { key: 'credits', label: 'Số tín chỉ', type: 'number', getValue: (row) => row.credits },
];
const ROWS: TestRow[] = [
  { code: 'XMM-2026-00002', status: 'xet', submittedAt: '2026-10-30T07:00', credits: 3 },
  { code: 'XMM-2026-00010', status: 'nop', submittedAt: '2026-10-12T09:30', credits: null },
  { code: 'XMM-2026-00001', status: 'duyet', submittedAt: '2026-09-01T08:15', credits: 2 },
];

/**
 * Tạo điều kiện lọc có giá trị.
 * @param fieldKey  cột
 * @param changes   giá trị, vd { value: 'xet' }
 * @returns         điều kiện lọc
 */
const ruleOf = (fieldKey: string, changes: Partial<FilterRule>): FilterRule => ({
  ...createFilterRule(fieldKey),
  ...changes,
});

/**
 * Mã đơn của các dòng, để so sánh kết quả cho gọn.
 * @param rows  các dòng
 * @returns     mã đơn theo thứ tự
 */
const codesOf = (rows: TestRow[]) => rows.map((row) => row.code);

/**
 * Sắp xếp ROWS bằng TanStack Table với các cột dựng từ FIELDS (đúng như bảng thật).
 * @param sorting  các dòng sắp xếp
 * @returns        mã đơn theo thứ tự sau khi sắp xếp
 */
function sortedCodes(sorting: SortingState): string[] {
  const table = createTable({
    data: ROWS,
    columns: buildColumns(FIELDS),
    state: { sorting },
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return table.getRowModel().rows.map((row) => row.original.code);
}

describe('displayText', () => {
  it('hiện chữ theo kiểu cột', () => {
    expect(displayText(FIELDS[1]!, ROWS[0]!)).toBe('Đang xét');
    expect(displayText(FIELDS[2]!, ROWS[0]!)).toBe('30/10/2026');
    expect(displayText(FIELDS[3]!, ROWS[1]!)).toBe('');
  });
});

describe('selectOptions', () => {
  it('không khai báo sẵn thì lấy các giá trị khác nhau trong dữ liệu', () => {
    expect(selectOptions(FIELDS[1]!, ROWS)).toEqual([
      { value: 'xet', label: 'Đang xét' },
      { value: 'nop', label: 'Đã nộp' },
      { value: 'duyet', label: 'Đã duyệt' },
    ]);
  });
});

describe('filterRows', () => {
  it('tìm không phân biệt dấu, hoa thường, trong chữ đang hiện', () => {
    expect(codesOf(filterRows(ROWS, FIELDS, 'DA NOP', []))).toEqual(['XMM-2026-00010']);
    expect(codesOf(filterRows(ROWS, FIELDS, '01/09', []))).toEqual(['XMM-2026-00001']);
    expect(filterRows(ROWS, FIELDS, '   ', [])).toHaveLength(3);
  });

  it('lọc theo lựa chọn, chữ nguyên ô, ngày, khoảng ngày', () => {
    expect(codesOf(filterRows(ROWS, FIELDS, '', [ruleOf('status', { value: 'xet' })]))).toEqual(['XMM-2026-00002']);
    expect(codesOf(filterRows(ROWS, FIELDS, '', [ruleOf('code', { value: ' xmm-2026-00001 ' })]))).toEqual([
      'XMM-2026-00001',
    ]);
    expect(codesOf(filterRows(ROWS, FIELDS, '', [ruleOf('submittedAt', { value: '2026-10-12' })]))).toEqual([
      'XMM-2026-00010',
    ]);
    const fromOctober = ruleOf('submittedAt', { operator: 'range', from: '2026-10-01' });
    expect(codesOf(filterRows(ROWS, FIELDS, '', [fromOctober]))).toEqual(['XMM-2026-00002', 'XMM-2026-00010']);
  });

  it('ô trống không thỏa điều kiện nào', () => {
    const anyCredits = ruleOf('credits', { operator: 'range', from: '0' });
    expect(codesOf(filterRows(ROWS, FIELDS, '', [anyCredits]))).toEqual(['XMM-2026-00002', 'XMM-2026-00001']);
  });

  it('nhiều điều kiện phải thỏa tất cả; điều kiện chưa có giá trị thì bỏ qua', () => {
    const rules = [ruleOf('submittedAt', { operator: 'range', from: '2026-10-01' }), ruleOf('status', { value: 'nop' })];
    expect(codesOf(filterRows(ROWS, FIELDS, '', rules))).toEqual(['XMM-2026-00010']);
    expect(isFilterActive(createFilterRule('status'))).toBe(false);
    expect(filterRows(ROWS, FIELDS, '', [createFilterRule('status')])).toHaveLength(3);
  });
});

describe('sắp xếp bằng TanStack Table', () => {
  it('chữ có số so theo giá trị số', () => {
    expect(sortedCodes([{ id: 'code', desc: false }])).toEqual(['XMM-2026-00001', 'XMM-2026-00002', 'XMM-2026-00010']);
  });

  it('cột lựa chọn so theo tên hiển thị; đổi chiều thì đảo ngược', () => {
    const ascending = sortedCodes([{ id: 'status', desc: false }]);
    const labels = ascending.map((code) => STATUS_LABELS[ROWS.find((row) => row.code === code)!.status]);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' })));
    expect(sortedCodes([{ id: 'status', desc: true }])).toEqual([...ascending].reverse());
  });

  it('ô trống luôn nằm cuối, dù sắp xếp chiều nào', () => {
    expect(sortedCodes([{ id: 'credits', desc: false }]).at(-1)).toBe('XMM-2026-00010');
    expect(sortedCodes([{ id: 'credits', desc: true }]).at(-1)).toBe('XMM-2026-00010');
  });

  it('thứ tự mặc định của bảng Đơn đã nộp: ngày nộp mới trước', () => {
    const newestFirst = sortedCodes([
      { id: 'submittedAt', desc: true },
      { id: 'code', desc: true },
    ]);
    expect(newestFirst).toEqual(['XMM-2026-00002', 'XMM-2026-00010', 'XMM-2026-00001']);
  });
});

describe('toggleEqualsFilter / equalsFilterValue (bấm ô thống kê để lọc)', () => {
  it('chưa lọc cột đó thì thêm điều kiện "=" giá trị đã bấm', () => {
    const rules = toggleEqualsFilter([], 'status', 'nop');
    expect(equalsFilterValue(rules, 'status')).toBe('nop');
  });

  it('bấm giá trị khác thì thay điều kiện cùng cột, giữ điều kiện cột khác', () => {
    const other = createFilterRule('formType');
    const rules = toggleEqualsFilter([{ ...createFilterRule('status'), value: 'nop' }, { ...other, value: 'xmm' }], 'status', 'xet');
    expect(equalsFilterValue(rules, 'status')).toBe('xet');
    expect(equalsFilterValue(rules, 'formType')).toBe('xmm');
    expect(rules).toHaveLength(2);
  });

  it('bấm lại đúng giá trị đang lọc thì bỏ lọc cột đó', () => {
    const rules = toggleEqualsFilter(toggleEqualsFilter([], 'status', 'nop'), 'status', 'nop');
    expect(equalsFilterValue(rules, 'status')).toBeNull();
  });
});
