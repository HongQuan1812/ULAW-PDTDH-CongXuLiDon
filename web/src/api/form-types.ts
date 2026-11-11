/* Hook gọi API loại đơn: danh sách, loại đơn đang mở, một loại đơn; tạo, lưu, xóa loại đơn. */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  formTypeDetailPath,
  type FormType,
  type FormTypesResponse,
  type OpenFormTypesResponse,
  type SaveFormTypeRequest,
} from '@ulaw/shared';
import { apiFetch } from './client';
import { FORM_STATS_KEY } from './forms';

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
 * Khóa lưu tạm một loại đơn.
 * @param formTypeId  mã loại đơn
 * @returns           vd ['formTypes', 'detail', 'xmm']
 */
export const formTypeDetailKey = (formTypeId: string) => ['formTypes', 'detail', formTypeId] as const;

/**
 * Một loại đơn, đủ cấu trúc các phần, câu hỏi (để vẽ trang nộp đơn).
 * @param formTypeId  mã loại đơn, vd 'xmm'
 * @returns           kết quả useQuery; data = loại đơn (FormType)
 */
export function useFormType(formTypeId: string) {
  return useQuery({
    queryKey: formTypeDetailKey(formTypeId),
    queryFn: () => apiFetch<FormType>(formTypeDetailPath(formTypeId)),
  });
}

/**
 * Tải lại những nơi hiện loại đơn sau khi tạo / lưu / xóa: bảng Quản lí loại đơn, hộp chọn loại đơn khi nộp đơn,
 * thống kê theo loại đơn ở Quản lí đơn.
 * @param queryClient  TanStack Query client
 */
function refreshFormTypeLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: FORM_TYPES_KEY });
  void queryClient.invalidateQueries({ queryKey: OPEN_FORM_TYPES_KEY });
  void queryClient.invalidateQueries({ queryKey: FORM_STATS_KEY });
}

/**
 * Lưu loại đơn: tạo mới (POST) hoặc lưu đè (PUT). Thành công thì trình soạn dùng ngay loại đơn máy chủ trả về, các danh sách tải lại.
 * @param formTypeId  mã loại đơn đang sửa; tạo mới thì null
 * @returns           kết quả useMutation; gọi mutate(loại đơn cần lưu). data = loại đơn đã lưu (tạo mới thì có mã loại đơn mới)
 */
export function useSaveFormType(formTypeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saveRequest: SaveFormTypeRequest) =>
      apiFetch<FormType>(formTypeId ? formTypeDetailPath(formTypeId) : ENDPOINTS.formTypes.create, {
        method: formTypeId ? 'PUT' : 'POST',
        body: JSON.stringify(saveRequest),
      }),
    onSuccess: (savedFormType) => {
      queryClient.setQueryData(formTypeDetailKey(savedFormType.id), savedFormType);
      refreshFormTypeLists(queryClient);
    },
  });
}

/**
 * Xóa loại đơn chưa có đơn nào. Thành công thì bỏ loại đơn khỏi bộ nhớ tạm, các danh sách tải lại.
 * @param formTypeId  mã loại đơn
 * @returns           kết quả useMutation; gọi mutate()
 */
export function useDeleteFormType(formTypeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(formTypeDetailPath(formTypeId), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: formTypeDetailKey(formTypeId) });
      refreshFormTypeLists(queryClient);
    },
  });
}
