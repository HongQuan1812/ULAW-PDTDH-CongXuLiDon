/* Bộ công cụ bảng dùng chung (như artifact/js/table-tools.js): khai báo cột, tìm kiếm, lọc, so sánh để sắp xếp.
   Phần tìm, lọc, sắp xếp nằm ở @ulaw/shared (máy chủ dùng để trả từng trang); ở đây thêm phần chỉ giao diện cần:
   điều kiện lọc có số định danh, tên chiều sắp xếp, bấm ô thống kê để lọc. Chỉ có hàm thuần, không có giao diện. */
import type { SortingState } from '@tanstack/react-table';
import { isFilterActive, type FieldType, type FilterOperator, type ListFilter } from '@ulaw/shared';

export {
  compareRows,
  displayText,
  filterOptionsOf,
  filterRows,
  isFilterActive,
  selectOptions,
  type FieldOption,
  type FieldType,
  type FilterOperator,
  type TableField,
} from '@ulaw/shared';

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

/* ---------- Lọc ---------- */

/** Một điều kiện lọc trên giao diện: như ListFilter gửi lên máy chủ, thêm số định danh. */
export interface FilterRule extends ListFilter {
  /** Số định danh để React giữ đúng dòng khi thêm / bỏ điều kiện */
  id: number;
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
 * Các điều kiện lọc gửi lên máy chủ: chỉ điều kiện đang có tác dụng, bỏ số định danh.
 * @param rules  các điều kiện lọc trên giao diện
 * @returns      các điều kiện lọc theo ListFilter
 */
export function toListFilters(rules: readonly FilterRule[]): ListFilter[] {
  return rules.filter(isFilterActive).map(({ fieldKey, operator, value, from, to }) => ({ fieldKey, operator, value, from, to }));
}

/**
 * Giá trị đang lọc "=" của một cột (để tô viền ô thống kê đang chọn).
 * @param rules     các điều kiện lọc hiện có
 * @param fieldKey  cột
 * @returns         giá trị đang lọc; không lọc cột đó thì null
 */
export function equalsFilterValue(rules: readonly FilterRule[], fieldKey: string): string | null {
  const rule = rules.find((candidate) => candidate.fieldKey === fieldKey && candidate.operator === 'equals' && candidate.value !== '');
  return rule ? rule.value : null;
}

/**
 * Bấm một ô thống kê: lọc cột đó "=" giá trị đã bấm (thay điều kiện cùng cột); bấm lại đúng giá trị đó thì bỏ lọc.
 * @param rules     các điều kiện lọc hiện có
 * @param fieldKey  cột
 * @param value     giá trị vừa bấm
 * @returns         danh sách điều kiện mới (điều kiện cột khác giữ nguyên)
 */
export function toggleEqualsFilter(rules: readonly FilterRule[], fieldKey: string, value: string): FilterRule[] {
  const wasOn = equalsFilterValue(rules, fieldKey) === value;
  const others = rules.filter((rule) => rule.fieldKey !== fieldKey);
  return wasOn ? others : [...others, { ...createFilterRule(fieldKey), value }];
}
