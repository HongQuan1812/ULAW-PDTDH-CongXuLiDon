/* SCHEMA PHỤ của các bảng danh sách phân trang ở máy chủ (bảng đơn, bảng tài khoản):
   kiểu cột, lựa chọn để lọc, dòng sắp xếp, điều kiện lọc, và một lần hỏi trang (ListQuery).
   Cách đọc / ghi ListQuery trên đường dẫn nằm ở api-contract/common.ts; cách tìm, lọc, sắp xếp nằm ở business-rules/lists--query.ts. */
import { z } from 'zod';

/** Kiểu cột: quyết định cách hiện, cách so sánh khi sắp xếp và cách lọc. */
export const FIELD_TYPES = ['text', 'select', 'number', 'date', 'datetime'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Một lựa chọn của cột kiểu select, vd { value: 'xet', label: 'Đang xét' }. */
export const FieldOptionSchema = z.object({ value: z.string(), label: z.string() });
export type FieldOption = z.infer<typeof FieldOptionSchema>;

/** Một dòng sắp xếp: cột nào, giảm dần không. Nhiều dòng thì dòng đầu ưu tiên nhất. */
export const ListSortRuleSchema = z.object({
  /** Tên cột, trùng TableField.key */
  id: z.string().min(1),
  desc: z.boolean(),
});
export type ListSortRule = z.infer<typeof ListSortRuleSchema>;

/** Điều kiện lọc: "=" hoặc "Trong khoảng" (chỉ cột ngày và số). */
export const FILTER_OPERATORS = ['equals', 'range'] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

/** Một điều kiện lọc. Các điều kiện cộng dồn: dòng phải thỏa tất cả. */
export const ListFilterSchema = z.object({
  /** Cột được lọc, trùng TableField.key */
  fieldKey: z.string().min(1),
  operator: z.enum(FILTER_OPERATORS),
  /** Giá trị khi operator = 'equals' */
  value: z.string().default(''),
  /** Hai đầu khoảng khi operator = 'range'; bỏ trống một đầu = không giới hạn đầu đó */
  from: z.string().default(''),
  to: z.string().default(''),
});
export type ListFilter = z.infer<typeof ListFilterSchema>;

/** Một lần hỏi một trang của bảng: trang nào, mấy dòng, tìm gì, xếp thế nào, lọc gì. */
export interface ListQuery {
  /** Trang cần lấy, đếm từ 1 */
  page: number;
  /** Số dòng mỗi trang */
  pageSize: number;
  /** Chữ trong ô tìm kiếm; "" = không tìm */
  search: string;
  /** Các dòng sắp xếp; [] = thứ tự mặc định của bảng */
  sort: ListSortRule[];
  /** Các điều kiện lọc đang có tác dụng */
  filters: ListFilter[];
}
