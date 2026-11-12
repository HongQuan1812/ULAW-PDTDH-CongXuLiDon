/* Gọi API danh sách phân trang ở máy chủ (bảng đơn, bảng tài khoản): mỗi lần lấy đúng một trang.
   Mỗi danh sách khai báo một ListSource (khóa lưu tạm + cách lấy một trang); useServerTable() dùng nó để tải, lưu tạm, tải trước trang sau. */
import { listQueryParams, type FieldOption, type ListPageMeta, type ListQuery } from '@ulaw/shared';

/** Một trang đã tải: các dòng, tổng số dòng khớp, trang thật sự, lựa chọn lọc. */
export interface ListPage<Row> {
  rows: Row[];
  /** Số dòng khớp tìm kiếm và bộ lọc (tất cả các trang) */
  total: number;
  /** Trang máy chủ thật sự trả về, đếm từ 1 */
  page: number;
  /** Lựa chọn lọc của các cột select không có lựa chọn cố định */
  filterOptions: Record<string, FieldOption[]>;
}

/** Nguồn của một bảng danh sách. */
export interface ListSource<Row> {
  /** Khóa gốc trong TanStack Query, vd ['forms', 'mine']. Làm mới khóa này (invalidateQueries) là làm mới mọi trang */
  queryKey: readonly unknown[];
  /** Lấy một trang */
  fetchPage: (listQuery: ListQuery) => Promise<ListPage<Row>>;
}

/**
 * Ghép đường dẫn API danh sách với các tham số của một trang.
 * @param path       đường dẫn sau /api, vd '/forms/mine'
 * @param listQuery  trang, số dòng, chữ tìm, sắp xếp, lọc
 * @returns          vd '/forms/mine?page=2&pageSize=8'
 */
export function listPath(path: string, listQuery: ListQuery): string {
  return `${path}?${new URLSearchParams(listQueryParams(listQuery))}`;
}

/**
 * Đổi trang máy chủ trả (mảng dòng mang tên riêng của nhóm, vd forms) sang ListPage.
 * @param rows      mảng dòng của trang, vd response.forms
 * @param pageMeta  phần chung: total, page, filterOptions
 * @returns         trang theo ListPage
 */
export function toListPage<Row>(rows: Row[], { total, page, filterOptions }: ListPageMeta): ListPage<Row> {
  return { rows, total, page, filterOptions };
}
