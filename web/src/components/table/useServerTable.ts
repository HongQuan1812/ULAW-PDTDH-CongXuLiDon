/* Bảng phân trang ở máy chủ (bảng đơn, bảng tài khoản): giữ chữ tìm kiếm, các dòng sắp xếp, các điều kiện lọc, trang đang xem;
   mỗi lần chỉ tải đúng một trang (máy chủ tìm, lọc, sắp xếp, đếm tổng). Khác useTableTools (tải hết rồi tự xử lí ở trình duyệt).
   - Gõ tìm kiếm: chờ người dùng ngừng gõ một chút mới hỏi máy chủ.
   - Đổi trang: trong lúc chờ, bảng vẫn hiện trang cũ (mờ đi, có vạch tải) để không giật; trang đã xem / đã tải trước thì hiện ngay.
   - Xem xong một trang thì tải trước trang sau (trừ lúc đang gõ tìm kiếm hoặc vừa đổi bộ lọc, sắp xếp).
   Cách xem được nhớ lại (tableStateStore.ts), nên đi qua trang khác rồi quay lại vẫn như cũ. */
import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { listQueryParams, type FieldOption, type ListQuery } from '@ulaw/shared';
import type { ListPage, ListSource } from '../../api/lists';
import { loadErrorMessage } from '../LoadError';
import { readTableState, saveTableState } from './tableStateStore';
import { isFilterActive, toListFilters, type FilterRule, type SortRules } from './tableTools';

/** Thời gian chờ sau lần gõ cuối rồi mới tìm trên máy chủ. */
const SEARCH_DEBOUNCE_MS = 300;

/** Một trang đã tải được coi là còn mới trong khoảng này: quay lại trang đó thì hiện ngay, không tải lại. */
const PAGE_STALE_TIME_MS = 30_000;

/** Giá trị rỗng dùng chung khi chưa tải xong, để bảng không bị tính lại mỗi lần vẽ. */
const NO_FILTER_OPTIONS: Record<string, FieldOption[]> = {};

interface ServerTableOptions<Row> {
  /** Tên riêng của bảng, để nhớ cách xem, vd 'profile.submittedForms' */
  tableId: string;
  /** Nguồn của bảng: khóa lưu tạm và cách lấy một trang. Phải giữ nguyên tham chiếu (hằng số, hoặc useMemo) */
  source: ListSource<Row>;
  /** Số dòng mỗi trang (cũng là số dòng mỗi lần tải) */
  pageSize: number;
  /** Tùy chọn: điều kiện lọc do nơi khác giữ (vd ô thống kê bấm để lọc). Bỏ trống thì hook tự giữ */
  filterRules?: FilterRule[];
  /** Đi kèm filterRules: gọi khi người dùng đổi điều kiện lọc */
  onFilterRulesChange?: (nextFilterRules: FilterRule[]) => void;
}

/** Trạng thái và dữ liệu của một bảng phân trang ở máy chủ. */
export interface ServerTable<Row> {
  /** Chữ đang có trong ô tìm kiếm (có thể chưa gửi lên máy chủ) */
  query: string;
  setQuery: (nextQuery: string) => void;
  /** Chữ tìm kiếm đã gửi lên máy chủ, ứng với các dòng đang hiện (để tô sáng) */
  searchText: string;
  sorting: SortRules;
  setSorting: (nextSorting: SortRules) => void;
  filterRules: FilterRule[];
  setFilterRules: (nextFilterRules: FilterRule[]) => void;
  /** Trang đang xem (hoặc vừa bấm, đang tải), đếm từ 0 */
  pageIndex: number;
  setPageIndex: (nextPageIndex: number) => void;
  pageSize: number;
  /** Số trang, theo tổng số dòng khớp */
  pageCount: number;
  /** Kết quả useQuery của trang đang xem, cho nút ↻ và câu báo lỗi */
  pageQuery: UseQueryResult<ListPage<Row>>;
  /** Các dòng đang hiện: của trang đang xem, hoặc của trang cũ trong lúc chờ trang mới */
  rows: readonly Row[];
  /** Số dòng khớp tìm kiếm và bộ lọc (tất cả các trang) */
  total: number;
  /** Lựa chọn lọc của các cột select không có lựa chọn cố định */
  filterOptions: Record<string, FieldOption[]>;
  /** Đang tìm hoặc lọc (để báo "không có dòng nào khớp" thay vì "chưa có dòng nào") */
  hasCriteria: boolean;
  /** Đang tải lần đầu, chưa có dòng nào để hiện */
  isFirstLoad: boolean;
  /** Đang chờ trang mới (đổi trang, tìm, lọc, sắp xếp): bảng đang hiện trang cũ */
  isPageLoading: boolean;
  /** Câu báo khi chưa tải được trang nào; null = không lỗi */
  errorMessage: string | null;
}

/**
 * Khóa lưu tạm một trang: khóa gốc của nguồn, rồi các tham số của trang.
 * @param source     nguồn của bảng
 * @param listQuery  trang, số dòng, chữ tìm, sắp xếp, lọc
 * @returns          vd ['forms', 'mine', 'page', { page: '2', pageSize: '8' }]
 */
function pageQueryKey<Row>(source: ListSource<Row>, listQuery: ListQuery): readonly unknown[] {
  return [...source.queryKey, 'page', listQueryParams(listQuery)];
}

/**
 * Chuỗi đại diện cho điều kiện tìm, sắp xếp, lọc; đổi chuỗi này là đổi kết quả, phải về trang 1.
 * @param searchText   chữ tìm đã gửi
 * @param sorting      các dòng sắp xếp
 * @param filterRules  các điều kiện lọc (chỉ tính điều kiện đang có tác dụng)
 * @returns            chuỗi JSON
 */
function criteriaKeyOf(searchText: string, sorting: SortRules, filterRules: readonly FilterRule[]): string {
  return JSON.stringify([searchText.trim(), sorting, toListFilters(filterRules)]);
}

/**
 * Trạng thái và dữ liệu của một bảng phân trang ở máy chủ.
 * Đổi chữ tìm kiếm, sắp xếp hoặc lọc thì bảng quay về trang 1. Cách xem được nhớ theo tableId.
 * @param options  tên bảng, nguồn, số dòng mỗi trang, (tùy chọn) điều kiện lọc do nơi khác giữ
 * @returns        xem ServerTable
 */
export function useServerTable<Row>({
  tableId,
  source,
  pageSize,
  filterRules: controlledFilterRules,
  onFilterRulesChange,
}: ServerTableOptions<Row>): ServerTable<Row> {
  const queryClient = useQueryClient();

  // Bắt đầu từ cách xem đã nhớ (nếu có)
  const [saved] = useState(() => readTableState(tableId));
  const [query, setQuery] = useState(saved?.query ?? '');
  const [searchText, setSearchText] = useState(saved?.query ?? '');
  const [sorting, setSorting] = useState<SortRules>(saved?.sorting ?? []);
  const [ownFilterRules, setOwnFilterRules] = useState<FilterRule[]>(saved?.filterRules ?? []);
  const filterRules = controlledFilterRules ?? ownFilterRules;

  // Trang người dùng chọn, kèm điều kiện lúc chọn: điều kiện đã đổi thì xem trang 1
  // (tính ngay khi vẽ, để không gửi nhầm "trang 5 của bộ lọc mới" lên máy chủ)
  const criteriaKey = criteriaKeyOf(searchText, sorting, filterRules);
  const [pageChoice, setPageChoice] = useState(() => ({ pageIndex: saved?.pageIndex ?? 0, criteriaKey }));
  const isBrowsingPages = pageChoice.criteriaKey === criteriaKey;
  const pageIndex = isBrowsingPages ? pageChoice.pageIndex : 0;
  const setPageIndex = (nextPageIndex: number) => setPageChoice({ pageIndex: nextPageIndex, criteriaKey });

  // Nhớ lại mỗi khi cách xem thay đổi
  useEffect(() => {
    saveTableState(tableId, { query, sorting, filterRules, pageIndex });
  }, [tableId, query, sorting, filterRules, pageIndex]);

  // Ngừng gõ một lúc thì mới tìm trên máy chủ
  useEffect(() => {
    if (query === searchText) return;
    const timer = setTimeout(() => setSearchText(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, searchText]);

  // Tải trang đang xem; trong lúc chờ thì giữ trang cũ (isPlaceholderData)
  const listQuery: ListQuery = {
    page: pageIndex + 1,
    pageSize,
    search: searchText.trim(),
    sort: sorting,
    filters: toListFilters(filterRules),
  };
  const listQueryKey = JSON.stringify(listQueryParams(listQuery));
  const pageQuery = useQuery({
    queryKey: pageQueryKey(source, listQuery),
    queryFn: () => source.fetchPage(listQuery),
    placeholderData: keepPreviousData,
    staleTime: PAGE_STALE_TIME_MS,
  });
  const pageData = pageQuery.data;
  const isPageLoading = pageQuery.isPlaceholderData;

  // Máy chủ trả trang khác trang đã hỏi (hỏi quá trang cuối, vd đơn vừa bị lọc ra): chuyển sang trang đó,
  // lưu sẵn dữ liệu vừa nhận vào khóa của trang đó để khỏi tải lại
  useEffect(() => {
    if (!pageData || isPageLoading || pageData.page === pageIndex + 1) return;
    const correctedQuery: ListQuery = { ...listQuery, page: pageData.page };
    queryClient.setQueryData(pageQueryKey(source, correctedQuery), pageData);
    setPageChoice({ pageIndex: pageData.page - 1, criteriaKey });
    // listQuery dựng lại mỗi lần vẽ nên không đưa vào danh sách theo dõi; listQueryKey đại diện cho nó
  }, [pageData, isPageLoading, pageIndex, listQueryKey, criteriaKey, queryClient, source]);

  // Đang lật trang (không gõ dở, không vừa đổi bộ lọc) và trang hiện tại đã tải xong: tải trước trang sau
  const canPrefetch = isBrowsingPages && query === searchText && pageData !== undefined && !isPageLoading;
  useEffect(() => {
    if (!canPrefetch || !pageData || pageData.page * pageSize >= pageData.total) return;
    const nextPageQuery: ListQuery = { ...listQuery, page: pageData.page + 1 };
    void queryClient.prefetchQuery({
      queryKey: pageQueryKey(source, nextPageQuery),
      queryFn: () => source.fetchPage(nextPageQuery),
      staleTime: PAGE_STALE_TIME_MS,
    });
  }, [canPrefetch, pageData, pageSize, listQueryKey, queryClient, source]);

  // Đổi lọc: báo nơi giữ điều kiện lọc (nếu có), không thì tự giữ
  const setFilterRules = (nextFilterRules: FilterRule[]) => {
    setOwnFilterRules(nextFilterRules);
    onFilterRulesChange?.(nextFilterRules);
  };

  const total = pageData?.total ?? 0;
  return {
    query,
    setQuery,
    searchText,
    sorting,
    setSorting,
    filterRules,
    setFilterRules,
    pageIndex,
    setPageIndex,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    pageQuery,
    rows: pageData?.rows ?? [],
    total,
    filterOptions: pageData?.filterOptions ?? NO_FILTER_OPTIONS,
    hasCriteria: searchText.trim() !== '' || filterRules.some(isFilterActive),
    isFirstLoad: pageQuery.isPending,
    isPageLoading,
    errorMessage: loadErrorMessage(pageQuery),
  };
}
