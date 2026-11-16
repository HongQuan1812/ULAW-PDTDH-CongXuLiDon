/* Hook gọi API Nguồn dữ liệu (chỉ vai trò có quyền manageDataSources). */
import { useQuery } from '@tanstack/react-query';
import { ENDPOINTS, type DataSourcesResponse } from '@ulaw/shared';
import { apiFetch } from './client';

/** Khóa lưu tạm tình trạng nguồn dữ liệu trong TanStack Query. */
export const DATA_SOURCES_KEY = ['dataSources'] as const;

/**
 * Tình trạng các nguồn dữ liệu; máy chủ thử kết nối mỗi lần gọi, nên nút ↻ là kiểm tra lại.
 * @returns  kết quả useQuery; data = { schoolDatabase }
 */
export function useDataSources() {
  return useQuery({
    queryKey: DATA_SOURCES_KEY,
    queryFn: () => apiFetch<DataSourcesResponse>(ENDPOINTS.dataSources.list),
  });
}
