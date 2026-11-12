/* Nhớ cách xem của từng bảng (chữ tìm kiếm, sắp xếp, lọc, trang đang xem) khi đi qua trang khác rồi quay lại,
   Chỉ giữ trong bộ nhớ: tải lại trang thì về ban đầu,
   đăng nhập hoặc đăng xuất thì xóa hết (gọi clearTableStates). */
import type { FilterRule, SortRules } from './tableTools';

/** Cách xem của một bảng. */
export interface TableViewState {
  query: string;
  sorting: SortRules;
  filterRules: FilterRule[];
  /** Trang đang xem, đếm từ 0 */
  pageIndex: number;
}

const savedStates = new Map<string, TableViewState>();

/**
 * Lấy cách xem đã nhớ của một bảng.
 * @param tableId  tên riêng của bảng, vd 'profile.submittedForms'
 * @returns        cách xem đã nhớ; chưa có thì undefined
 */
export function readTableState(tableId: string): TableViewState | undefined {
  return savedStates.get(tableId);
}

/**
 * Nhớ cách xem của một bảng.
 * @param tableId  tên riêng của bảng
 * @param state    cách xem hiện tại
 */
export function saveTableState(tableId: string, state: TableViewState): void {
  savedStates.set(tableId, state);
}

/** Quên cách xem của mọi bảng (khi đăng nhập, đăng xuất). */
export function clearTableStates(): void {
  savedStates.clear();
}
