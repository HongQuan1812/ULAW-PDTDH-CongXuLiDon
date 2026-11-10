/* Bộ công cụ bảng dùng chung (như artifact/js/table-tools.js): khai báo cột, tìm kiếm, lọc, so sánh để sắp xếp.
   Chỉ có hàm thuần, không có giao diện; sắp xếp nhiều cột và phân trang do TanStack Table làm (xem useTableTools.ts). */
import type { SortingState } from '@tanstack/react-table';
import { formatDate, formatDateTime } from '../../lib/format';
import { normalizeText } from '../../lib/search';

/* ---------- Khai báo cột ---------- */

/** Kiểu cột: quyết định cách hiện, cách so sánh khi sắp xếp và cách lọc. */
export type FieldType = 'text' | 'select' | 'number' | 'date' | 'datetime';

/** Một lựa chọn của cột kiểu select, vd { value: 'xet', label: 'Đang xét' }. */
export interface FieldOption {
  value: string;
  label: string;
}

/** Một cột của bảng. */
export interface TableField<Row> {
  /** Tên cột trong code, vd 'status' */
  key: string;
  /** Tên cột hiện trên tiêu đề và trong bảng Sắp xếp / Lọc, vd 'Trạng thái' */
  label: string;
  type: FieldType;
  /** Giá trị thô để lọc, sắp xếp: chuỗi (ngày dạng 'YYYY-MM-DD…'), số; null = ô trống */
  getValue: (row: Row) => string | number | null;
  /** Chỉ cột select: tên hiển thị của giá trị trong dòng, vd 'xet' → 'Đang xét' */
  getLabel?: (row: Row) => string;
  /** Chỉ cột select: các lựa chọn cố định khi lọc. Không có thì lấy từ dữ liệu đang có */
  options?: readonly FieldOption[];
}

/**
 * Chữ hiện trong ô của một cột. Tìm kiếm chỉ tìm trong chữ này (đúng như người dùng thấy).
 * @param field  cột
 * @param row    dòng dữ liệu
 * @returns      chữ hiện trong ô; ô trống thì ""
 */
export function displayText<Row>(field: TableField<Row>, row: Row): string {
  const value = field.getValue(row);
  if (value === null || value === '') return '';
  if (field.type === 'select') return field.getLabel?.(row) ?? String(value);
  if (field.type === 'date') return formatDate(String(value));
  if (field.type === 'datetime') return formatDateTime(String(value));
  return String(value);
}

/**
 * Các lựa chọn để lọc một cột select: lựa chọn cố định, hoặc các giá trị khác nhau đang có trong dữ liệu.
 * @param field  cột select
 * @param rows   toàn bộ dữ liệu của bảng
 * @returns      danh sách lựa chọn
 */
export function selectOptions<Row>(field: TableField<Row>, rows: readonly Row[]): FieldOption[] {
  if (field.options) return [...field.options];
  const labelsByValue = new Map<string, string>();
  rows.forEach((row) => {
    const value = field.getValue(row);
    if (value !== null && value !== '' && !labelsByValue.has(String(value))) {
      labelsByValue.set(String(value), displayText(field, row));
    }
  });
  return [...labelsByValue].map(([value, label]) => ({ value, label }));
}

/* ---------- Sắp xếp ---------- */

/** Các dòng sắp xếp theo thứ tự ưu tiên, dòng đầu ưu tiên nhất: [{ id: tên cột, desc: giảm dần? }]. */
export type SortRules = SortingState;

/** Tên hai chiều sắp xếp theo kiểu cột: [tăng dần, giảm dần]. */
export const SORT_DIRECTION_LABELS: Record<FieldType, [string, string]> = {
  number: ['Nhỏ → lớn', 'Lớn → nhỏ'],
  text: ['A → Z', 'Z → A'],
  select: ['A → Z', 'Z → A'],
  date: ['Cũ → mới', 'Mới → cũ'],
  datetime: ['Cũ → mới', 'Mới → cũ'],
};

/**
 * So sánh hai dòng theo một cột (tăng dần). Ô trống do TanStack Table xếp cuối, không qua hàm này.
 * Cột select so theo tên hiển thị; cột số so theo số; còn lại so chữ kiểu tiếng Việt, số trong chữ so theo giá trị.
 * @param field  cột
 * @param rowA   dòng thứ nhất
 * @param rowB   dòng thứ hai
 * @returns      âm nếu rowA đứng trước, dương nếu đứng sau, 0 nếu bằng nhau
 */
export function compareRows<Row>(field: TableField<Row>, rowA: Row, rowB: Row): number {
  if (field.type === 'number') return Number(field.getValue(rowA)) - Number(field.getValue(rowB));
  const textA = field.type === 'select' ? displayText(field, rowA) : String(field.getValue(rowA));
  const textB = field.type === 'select' ? displayText(field, rowB) : String(field.getValue(rowB));
  return textA.localeCompare(textB, 'vi', { numeric: true, sensitivity: 'base' });
}

/* ---------- Lọc ---------- */

/** Điều kiện lọc: "=" hoặc "Trong khoảng" (chỉ cột ngày và số). */
export type FilterOperator = 'equals' | 'range';

/** Một điều kiện lọc. Các điều kiện cộng dồn: dòng phải thỏa tất cả. */
export interface FilterRule {
  /** Số định danh để React giữ đúng dòng khi thêm / bỏ điều kiện */
  id: number;
  /** Cột được lọc, trùng TableField.key */
  fieldKey: string;
  operator: FilterOperator;
  /** Giá trị khi operator = 'equals' */
  value: string;
  /** Hai đầu khoảng khi operator = 'range'; bỏ trống một đầu = không giới hạn đầu đó */
  from: string;
  to: string;
}

/**
 * Các điều kiện lọc dùng được cho một kiểu cột.
 * @param type  kiểu cột
 * @returns     danh sách [điều kiện, tên hiện]
 */
export function filterOperators(type: FieldType): [FilterOperator, string][] {
  return type === 'date' || type === 'datetime' || type === 'number'
    ? [['equals', '='], ['range', 'Trong khoảng']]
    : [['equals', '=']];
}

let nextFilterRuleId = 1;

/**
 * Tạo một điều kiện lọc trống trên một cột.
 * @param fieldKey  cột được lọc
 * @returns         điều kiện lọc chưa có giá trị (chưa có tác dụng)
 */
export function createFilterRule(fieldKey: string): FilterRule {
  return { id: nextFilterRuleId++, fieldKey, operator: 'equals', value: '', from: '', to: '' };
}

/**
 * Điều kiện lọc đã có giá trị chưa. Điều kiện chưa có giá trị thì không lọc gì và không được đếm.
 * @param rule  điều kiện lọc
 * @returns     true nếu đang có tác dụng
 */
export function isFilterActive(rule: FilterRule): boolean {
  return rule.operator === 'range' ? Boolean(rule.from || rule.to) : rule.value !== '';
}

/**
 * Một dòng có thỏa một điều kiện lọc không. Ô trống không thỏa điều kiện nào.
 * Chữ so khớp nguyên ô, không phân biệt hoa thường và dấu; ngày so theo ngày (bỏ giờ).
 * @param field  cột của điều kiện
 * @param rule   điều kiện lọc (đã có tác dụng)
 * @param row    dòng dữ liệu
 * @returns      true nếu thỏa
 */
function matchesRule<Row>(field: TableField<Row>, rule: FilterRule, row: Row): boolean {
  const rawValue = field.getValue(row);
  if (rawValue === null || rawValue === '') return false;

  // Lựa chọn và chữ: phải bằng
  if (field.type === 'select') return String(rawValue) === rule.value;
  if (field.type === 'text') return normalizeText(String(rawValue)) === normalizeText(rule.value.trim());

  // Số: bằng, hoặc trong khoảng
  if (field.type === 'number') {
    const number = Number(rawValue);
    if (rule.operator === 'equals') return number === Number(rule.value);
    return (rule.from === '' || number >= Number(rule.from)) && (rule.to === '' || number <= Number(rule.to));
  }

  // Ngày: so phần 'YYYY-MM-DD' như chuỗi
  const day = String(rawValue).slice(0, 10);
  if (rule.operator === 'equals') return day === rule.value;
  return (!rule.from || day >= rule.from) && (!rule.to || day <= rule.to);
}

/**
 * Lọc dữ liệu theo ô tìm kiếm và các điều kiện lọc.
 * @param rows         toàn bộ dữ liệu
 * @param fields       các cột của bảng
 * @param query        chữ trong ô tìm kiếm: dòng có ít nhất một ô chứa chữ này (không phân biệt dấu)
 * @param filterRules  các điều kiện lọc: dòng phải thỏa tất cả điều kiện đang có tác dụng
 * @returns            các dòng còn lại, giữ thứ tự cũ
 */
export function filterRows<Row>(
  rows: readonly Row[],
  fields: readonly TableField<Row>[],
  query: string,
  filterRules: readonly FilterRule[],
): Row[] {
  const keyword = normalizeText(query.trim());
  const activeRules = filterRules
    .filter(isFilterActive)
    .flatMap((rule) => {
      const field = fields.find((candidate) => candidate.key === rule.fieldKey);
      return field ? [{ field, rule }] : [];
    });

  return rows.filter(
    (row) =>
      (!keyword || fields.some((field) => normalizeText(displayText(field, row)).includes(keyword))) &&
      activeRules.every(({ field, rule }) => matchesRule(field, rule, row)),
  );
}
