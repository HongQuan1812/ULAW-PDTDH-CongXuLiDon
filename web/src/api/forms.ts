/* Hook gọi API lá đơn. */
import { useQuery } from '@tanstack/react-query';
import { ENDPOINTS, type MyFormsResponse } from '@ulaw/shared';
import { apiFetch } from './client';

/** Khóa lưu tạm danh sách đơn của mình trong TanStack Query. */
export const MY_FORMS_KEY = ['forms', 'mine'] as const;

/**
 * Các đơn mình đã nộp.
 * @returns  kết quả useQuery; data = mảng đơn (FormSummary[])
 */
export function useMyForms() {
  return useQuery({
    queryKey: MY_FORMS_KEY,
    queryFn: () => apiFetch<MyFormsResponse>(ENDPOINTS.forms.mine),
    select: (response) => response.forms,
  });
}
