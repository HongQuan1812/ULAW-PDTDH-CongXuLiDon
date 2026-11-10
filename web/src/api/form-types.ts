/* Hook gọi API loại đơn. */
import { useQuery } from '@tanstack/react-query';
import { ENDPOINTS, type OpenFormTypesResponse } from '@ulaw/shared';
import { apiFetch } from './client';

/** Khóa lưu tạm danh sách loại đơn đang mở trong TanStack Query. */
export const OPEN_FORM_TYPES_KEY = ['formTypes', 'open'] as const;

/**
 * Các loại đơn đang nhận đơn.
 * @param enabled  true thì tải (vd chỉ tải khi người dùng có quyền nộp đơn)
 * @returns        kết quả useQuery; data = mảng loại đơn (OpenFormType[])
 */
export function useOpenFormTypes(enabled: boolean) {
  return useQuery({
    queryKey: OPEN_FORM_TYPES_KEY,
    queryFn: () => apiFetch<OpenFormTypesResponse>(ENDPOINTS.formTypes.open),
    select: (response) => response.formTypes,
    enabled,
  });
}
