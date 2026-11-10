/* Nối bộ công cụ bảng với TanStack Table: giữ chữ tìm kiếm, các dòng sắp xếp, các điều kiện lọc, trang đang xem;
   lọc trước bằng filterRows(), rồi để TanStack Table sắp xếp nhiều cột và chia trang.
   Cách xem được nhớ lại (tableStateStore.ts), nên đi qua trang khác rồi quay lại vẫn như cũ. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { readTableState, saveTableState } from './tableStateStore';
import { compareRows, filterRows, isFilterActive, type FilterRule, type SortRules, type TableField } from './tableTools';

/**
 * Dựng cột cho TanStack Table từ khai báo cột: mỗi cột một cách so sánh riêng (compareRows),
 * ô trống luôn nằm cuối dù sắp xếp chiều nào.
 * @param fields  các cột
 * @returns       cột theo kiểu của TanStack Table, id trùng TableField.key
 */
export function buildColumns<Row>(fields: readonly TableField<Row>[]): ColumnDef<Row>[] {
  return fields.map((field) => ({
    id: field.key,
    accessorFn: (row: Row) => field.getValue(row) ?? undefined,
    sortingFn: (rowA, rowB) => compareRows(field, rowA.original, rowB.original),
    sortUndefined: 'last',
  }));
}

interface TableToolsOptions<Row> {
  /** Tên riêng của bảng, để nhớ cách xem, vd 'profile.submittedForms' */
  tableId: string;
  /** Toàn bộ dữ liệu (chưa lọc). Phải giữ nguyên tham chiếu giữa các lần vẽ, vd lấy thẳng từ useQuery */
  rows: readonly Row[];
  /** Các cột. Phải giữ nguyên tham chiếu, vd khai báo ngoài component */
  fields: readonly TableField<Row>[];
  /** Thứ tự khi người dùng chưa chọn sắp xếp, vd đơn mới nộp lên trên */
  defaultSorting: SortRules;
  /** Số dòng mỗi trang */
  pageSize: number;
  /** Khóa riêng của mỗi dòng, vd mã đơn */
  getRowId: (row: Row) => string;
  /** Tùy chọn: điều kiện lọc do nơi khác giữ (vd ô thống kê bấm để lọc). Bỏ trống thì hook tự giữ */
  filterRules?: FilterRule[];
  /** Đi kèm filterRules: gọi khi người dùng đổi điều kiện lọc */
  onFilterRulesChange?: (nextFilterRules: FilterRule[]) => void;
}

/**
 * Trạng thái và dữ liệu đã xử lí của một bảng có tìm kiếm, Sắp xếp, Lọc, phân trang.
 * Đổi chữ tìm kiếm, sắp xếp hoặc lọc thì bảng quay về trang 1. Cách xem được nhớ theo tableId.
 * @param options  tên bảng, dữ liệu, các cột, thứ tự mặc định, số dòng mỗi trang, khóa của dòng
 * @returns        table (TanStack Table: các dòng của trang đang xem, chuyển trang),
 *                 query / sorting / filterRules và hàm đổi từng thứ,
 *                 matchedCount (số dòng sau khi tìm, lọc), hasCriteria (đang tìm hoặc lọc)
 */
export function useTableTools<Row>({
  tableId,
  rows,
  fields,
  defaultSorting,
  pageSize,
  getRowId,
  filterRules: controlledFilterRules,
  onFilterRulesChange,
}: TableToolsOptions<Row>) {
  // Bắt đầu từ cách xem đã nhớ (nếu có)
  const [saved] = useState(() => readTableState(tableId));
  const [query, setQueryState] = useState(saved?.query ?? '');
  const [sorting, setSortingState] = useState<SortRules>(saved?.sorting ?? []);
  const [ownFilterRules, setOwnFilterRules] = useState<FilterRule[]>(saved?.filterRules ?? []);
  const filterRules = controlledFilterRules ?? ownFilterRules;
  const [pageIndex, setPageIndex] = useState(saved?.pageIndex ?? 0);

  // Nhớ lại mỗi khi cách xem thay đổi
  useEffect(() => {
    saveTableState(tableId, { query, sorting, filterRules, pageIndex });
  }, [tableId, query, sorting, filterRules, pageIndex]);

  // Điều kiện lọc do nơi khác đổi (vd bấm ô thống kê) thì cũng về trang 1; lần vẽ đầu giữ trang đã nhớ
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (controlledFilterRules) setPageIndex(0);
  }, [controlledFilterRules]);

  // Đổi tìm kiếm, sắp xếp, lọc thì về trang 1
  const setQuery = (nextQuery: string) => {
    setQueryState(nextQuery);
    setPageIndex(0);
  };
  const setSorting = (nextSorting: SortRules) => {
    setSortingState(nextSorting);
    setPageIndex(0);
  };
  const setFilterRules = (nextFilterRules: FilterRule[]) => {
    setOwnFilterRules(nextFilterRules);
    onFilterRulesChange?.(nextFilterRules);
    setPageIndex(0);
  };

  // Lọc trước theo ô tìm kiếm và điều kiện lọc
  const matchedRows = useMemo(
    () => filterRows(rows, fields, query, filterRules),
    [rows, fields, query, filterRules],
  );

  const columns = useMemo(() => buildColumns(fields), [fields]);

  // Trang đã nhớ vượt quá số trang hiện có (vd ít đơn hơn) thì xem trang cuối
  const pageCount = Math.max(1, Math.ceil(matchedRows.length / pageSize));
  const shownPageIndex = Math.min(pageIndex, pageCount - 1);

  // Chưa chọn sắp xếp thì dùng thứ tự mặc định (bảng Sắp xếp vẫn hiện là chưa chọn).
  // Không để TanStack Table tự về trang 1 khi dữ liệu đổi: lúc quay lại trang, dữ liệu tải xong sẽ làm mất trang đã nhớ
  const table = useReactTable({
    data: matchedRows as Row[],
    columns,
    state: {
      sorting: sorting.length ? sorting : defaultSorting,
      pagination: { pageIndex: shownPageIndex, pageSize },
    },
    onPaginationChange: (updater) =>
      setPageIndex((current) =>
        typeof updater === 'function' ? updater({ pageIndex: current, pageSize }).pageIndex : updater.pageIndex,
      ),
    autoResetPageIndex: false,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const hasCriteria = query.trim() !== '' || filterRules.some(isFilterActive);

  return {
    table,
    query,
    setQuery,
    sorting,
    setSorting,
    filterRules,
    setFilterRules,
    matchedCount: matchedRows.length,
    hasCriteria,
  };
}
