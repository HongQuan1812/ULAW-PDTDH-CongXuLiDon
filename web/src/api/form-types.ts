/* Hook gọi API loại đơn: danh sách, loại đơn đang mở, phiên bản đang mở (để nộp đơn);
   các phiên bản (trình soạn): xem, tạo loại đơn, thêm phiên bản, lưu phiên bản Nháp, mở / đóng, xóa phiên bản Nháp. */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  formTypeDetailPath,
  formTypeVersionPath,
  formTypeVersionStatusPath,
  formTypeVersionsPath,
  type FormType,
  type FormTypesResponse,
  type ManagedFormType,
  type OpenFormTypesResponse,
  type SaveFormTypeVersionRequest,
  type SetFormTypeVersionStatusRequest,
} from '@ulaw/shared';
import { apiFetch } from './client';
import { FORM_STATS_KEY } from './forms';

/** Khóa lưu tạm mọi loại đơn (trang Quản lí loại đơn). */
export const FORM_TYPES_KEY = ['formTypes', 'all'] as const;

/**
 * Mọi loại đơn, mỗi loại một dòng theo phiên bản mới nhất, cho trang Quản lí loại đơn. Cần quyền manageFormTypes.
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
 * Khóa lưu tạm phiên bản đang mở của một loại đơn (trang nộp đơn).
 * @param formTypeId  mã loại đơn
 * @returns           vd ['formTypes', 'detail', 'xmm']
 */
export const formTypeDetailKey = (formTypeId: string) => ['formTypes', 'detail', formTypeId] as const;

/**
 * Phiên bản đang mở của một loại đơn, đủ cấu trúc các phần, câu hỏi (để vẽ trang nộp đơn).
 * @param formTypeId  mã loại đơn, vd 'xmm'
 * @returns           kết quả useQuery; data = loại đơn (FormType); không có phiên bản nào đang mở thì lỗi 404
 */
export function useFormType(formTypeId: string) {
  return useQuery({
    queryKey: formTypeDetailKey(formTypeId),
    queryFn: () => apiFetch<FormType>(formTypeDetailPath(formTypeId)),
  });
}

/**
 * Khóa lưu tạm loại đơn kèm mọi phiên bản (trình soạn).
 * @param formTypeId  mã loại đơn
 * @returns           vd ['formTypes', 'versions', 'xmm']
 */
export const managedFormTypeKey = (formTypeId: string) => ['formTypes', 'versions', formTypeId] as const;

/**
 * Loại đơn kèm mọi phiên bản, cho trình soạn. Cần quyền manageFormTypes.
 * @param formTypeId  mã loại đơn
 * @returns           kết quả useQuery; data = ManagedFormType (phiên bản mới nhất trước)
 */
export function useManagedFormType(formTypeId: string) {
  return useQuery({
    queryKey: managedFormTypeKey(formTypeId),
    queryFn: () => apiFetch<ManagedFormType>(formTypeVersionsPath(formTypeId)),
  });
}

/**
 * Sau một lệnh sửa loại đơn: trình soạn dùng ngay loại đơn máy chủ trả về; bảng Quản lí loại đơn, hộp chọn loại đơn khi nộp đơn,
 * trang nộp đơn và thống kê theo loại đơn tải lại.
 * @param queryClient  TanStack Query client
 * @param formTypeId   mã loại đơn vừa sửa
 * @param formType     loại đơn sau khi sửa; đã xóa loại đơn thì null
 */
function afterFormTypeChange(queryClient: QueryClient, formTypeId: string, formType: ManagedFormType | null): void {
  if (formType) queryClient.setQueryData(managedFormTypeKey(formTypeId), formType);
  else queryClient.removeQueries({ queryKey: managedFormTypeKey(formTypeId) });
  void queryClient.invalidateQueries({ queryKey: FORM_TYPES_KEY });
  void queryClient.invalidateQueries({ queryKey: OPEN_FORM_TYPES_KEY });
  void queryClient.invalidateQueries({ queryKey: formTypeDetailKey(formTypeId) });
  void queryClient.invalidateQueries({ queryKey: FORM_STATS_KEY });
}

/** Lưu bản soạn: tạo loại đơn mới, thêm phiên bản mới, hoặc lưu đè phiên bản Nháp. */
export type SaveFormTypeVersionTarget =
  | { kind: 'createFormType' }
  | { kind: 'addVersion'; formTypeId: string }
  | { kind: 'saveDraft'; formTypeId: string; version: number };

/**
 * Lưu bản soạn của trình soạn.
 * @returns  kết quả useMutation; gọi mutate({ target, saveRequest }). data = loại đơn kèm mọi phiên bản sau khi lưu
 */
export function useSaveFormTypeVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, saveRequest }: { target: SaveFormTypeVersionTarget; saveRequest: SaveFormTypeVersionRequest }) => {
      const body = JSON.stringify(saveRequest);
      if (target.kind === 'createFormType') return apiFetch<ManagedFormType>(ENDPOINTS.formTypes.create, { method: 'POST', body });
      if (target.kind === 'addVersion') return apiFetch<ManagedFormType>(formTypeVersionsPath(target.formTypeId), { method: 'POST', body });
      return apiFetch<ManagedFormType>(formTypeVersionPath(target.formTypeId, target.version), { method: 'PUT', body });
    },
    onSuccess: (formType) => afterFormTypeChange(queryClient, formType.id, formType),
  });
}

/**
 * Mở / đóng một phiên bản đã khóa.
 * @param formTypeId  mã loại đơn
 * @returns           kết quả useMutation; gọi mutate({ version, status }). data = loại đơn sau khi đổi
 */
export function useSetFormTypeVersionStatus(formTypeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ version, status }: { version: number } & SetFormTypeVersionStatusRequest) =>
      apiFetch<ManagedFormType>(formTypeVersionStatusPath(formTypeId, version), { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: (formType) => afterFormTypeChange(queryClient, formTypeId, formType),
  });
}

/**
 * Xóa phiên bản Nháp; phiên bản duy nhất thì máy chủ xóa luôn loại đơn.
 * @param formTypeId  mã loại đơn
 * @returns           kết quả useMutation; gọi mutate(số phiên bản). data = loại đơn còn lại, hoặc null khi đã xóa loại đơn
 */
export function useDeleteFormTypeVersion(formTypeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (version: number) =>
      (await apiFetch<ManagedFormType | undefined>(formTypeVersionPath(formTypeId, version), { method: 'DELETE' })) ?? null,
    onSuccess: (formType) => afterFormTypeChange(queryClient, formTypeId, formType),
  });
}
