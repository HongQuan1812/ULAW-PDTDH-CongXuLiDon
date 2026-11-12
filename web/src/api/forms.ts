/* Hook gọi API nhiều lá đơn: bảng đơn của mình, đơn phụ trách, Quản lí đơn (từng trang), thống kê, CCCD người nộp. */
import { useQuery } from '@tanstack/react-query';
import {
  ENDPOINTS,
  userIdsParams,
  type FormCccdsResponse,
  type FormStats,
  type FormSummary,
  type HandledFormSummary,
  type HandledFormsResponse,
  type ManagedFormSummary,
  type ManagedFormsResponse,
  type MyFormsResponse,
} from '@ulaw/shared';
import { apiFetch } from './client';
import { listPath, toListPage, type ListSource } from './lists';

/** Khóa lưu tạm các trang đơn của mình trong TanStack Query. */
export const MY_FORMS_KEY = ['forms', 'mine'] as const;

/** Bảng "Đơn đã nộp": từng trang trong các đơn mình đã nộp. */
export const MY_FORMS_SOURCE: ListSource<FormSummary> = {
  queryKey: MY_FORMS_KEY,
  fetchPage: async (listQuery) => {
    const { forms, ...pageMeta } = await apiFetch<MyFormsResponse>(listPath(ENDPOINTS.forms.mine, listQuery));
    return toListPage(forms, pageMeta);
  },
};

/** Khóa lưu tạm các trang đơn phụ trách của mình. */
export const HANDLED_FORMS_KEY = ['forms', 'handled'] as const;

/** Bảng "Đơn phụ trách" của mình (chỉ vai trò có quyền decide): từng trang, kèm người tiếp nhận, người xử lí. */
export const HANDLED_FORMS_SOURCE: ListSource<HandledFormSummary> = {
  queryKey: HANDLED_FORMS_KEY,
  fetchPage: async (listQuery) => {
    const { forms, ...pageMeta } = await apiFetch<HandledFormsResponse>(listPath(ENDPOINTS.forms.handled, listQuery));
    return toListPage(forms, pageMeta);
  },
};

/** Khóa lưu tạm các trang của bảng Quản lí đơn. */
export const ALL_FORMS_KEY = ['forms', 'all'] as const;

/** Bảng Quản lí đơn (chỉ vai trò có quyền viewAll): từng trang trong mọi đơn, kèm người nộp. */
export const ALL_FORMS_SOURCE: ListSource<ManagedFormSummary> = {
  queryKey: ALL_FORMS_KEY,
  fetchPage: async (listQuery) => {
    const { forms, ...pageMeta } = await apiFetch<ManagedFormsResponse>(listPath(ENDPOINTS.forms.list, listQuery));
    return toListPage(forms, pageMeta);
  },
};

/** Khóa lưu tạm số liệu thống kê; tải lại cùng lúc với bảng Quản lí đơn (tiếp nhận, duyệt… làm số đổi). */
export const FORM_STATS_KEY = ['forms', 'stats'] as const;

/**
 * Số đơn theo trạng thái và theo loại đơn (chỉ vai trò có quyền viewAll).
 * @returns  kết quả useQuery; data = FormStats
 */
export function useFormStats() {
  return useQuery({ queryKey: FORM_STATS_KEY, queryFn: () => apiFetch<FormStats>(ENDPOINTS.forms.stats) });
}

/**
 * CCCD đầy đủ của những người nộp đang có trên trang bảng; chỉ tải khi bấm "Hiện CCCD", không giữ lại sau khi ẩn.
 * @param enabled       true = tải
 * @param applicantIds  id những người nộp đang có trên trang bảng
 * @returns             kết quả useQuery; data = CCCD theo id người nộp
 */
export function useApplicantCccds(enabled: boolean, applicantIds: readonly string[]) {
  const sortedIds = [...new Set(applicantIds)].sort();
  return useQuery({
    queryKey: ['forms', 'cccds', sortedIds],
    queryFn: () => apiFetch<FormCccdsResponse>(`${ENDPOINTS.forms.cccds}?${new URLSearchParams(userIdsParams(sortedIds))}`),
    select: (response) => response.cccds,
    enabled: enabled && sortedIds.length > 0,
    gcTime: 0,
  });
}
