/* Hook gọi API loại đơn. */
import { useQuery } from '@tanstack/react-query';
import { ENDPOINTS, formTypeDetailPath, type FormType, type FormTypesResponse, type OpenFormTypesResponse } from '@ulaw/shared';
import { apiFetch } from './client';

/** Khóa lưu tạm mọi loại đơn (trang Quản lí loại đơn). */
export const FORM_TYPES_KEY = ['formTypes', 'all'] as const;

/**
 * Mọi loại đơn (Nháp, Đang mở, Đã đóng), cho trang Quản lí loại đơn. Cần quyền manageFormTypes.
 * @returns  kết quả useQuery; data = mảng loại đơn (FormTypeSummary[])
 */
export function useFormTypes() {
  return useQuery({
    queryKey: FORM_TYPES_KEY,
    queryFn: () => apiFetch<FormTypesResponse>(ENDPOINTS.formTypes.list),
    select: (response) => response.formTypes,
  });
}

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

/**
 * Một loại đơn, đủ cấu trúc các phần, câu hỏi (để vẽ trang nộp đơn).
 * @param formTypeId  mã loại đơn, vd 'xmm'
 * @returns           kết quả useQuery; data = loại đơn (FormType)
 */
export function useFormType(formTypeId: string) {
  return useQuery({
    queryKey: ['formTypes', 'detail', formTypeId],
    queryFn: () => apiFetch<FormType>(formTypeDetailPath(formTypeId)),
  });
}
