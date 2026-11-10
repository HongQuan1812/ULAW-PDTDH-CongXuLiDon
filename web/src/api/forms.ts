/* Hook gọi API lá đơn. */
import { useQuery } from '@tanstack/react-query';
import { ENDPOINTS, type HandledFormsResponse, type MyFormsResponse } from '@ulaw/shared';
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

/** Khóa lưu tạm danh sách đơn phụ trách của mình. */
export const HANDLED_FORMS_KEY = ['forms', 'handled'] as const;

/**
 * Các đơn mình tiếp nhận hoặc đang xử lí (chỉ vai trò có quyền decide).
 * @returns  kết quả useQuery; data = mảng đơn kèm người tiếp nhận, người xử lí (HandledFormSummary[])
 */
export function useHandledForms() {
  return useQuery({
    queryKey: HANDLED_FORMS_KEY,
    queryFn: () => apiFetch<HandledFormsResponse>(ENDPOINTS.forms.handled),
    select: (response) => response.forms,
  });
}
