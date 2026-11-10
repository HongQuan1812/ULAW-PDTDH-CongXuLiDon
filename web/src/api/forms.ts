/* Hook gọi API lá đơn. */
import { useQuery } from '@tanstack/react-query';
import {
  ENDPOINTS,
  SUBMIT_FORM_FIELDS,
  formDetailPath,
  type FormDetail,
  type FormSummary,
  type HandledFormsResponse,
  type MyFormsResponse,
  type SubmitFormRequest,
} from '@ulaw/shared';
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

/**
 * Khóa lưu tạm nội dung một lá đơn.
 * @param code  mã đơn
 * @returns     vd ['forms', 'detail', 'XMM-2026-00001']
 */
export const formDetailKey = (code: string) => ['forms', 'detail', code] as const;

/**
 * Một lá đơn đủ nội dung (trang chi tiết đơn).
 * @param code  mã đơn, vd 'XMM-2026-00001'
 * @returns     kết quả useQuery; data = lá đơn (FormDetail); không có hoặc không được xem thì lỗi 404
 */
export function useFormDetail(code: string) {
  return useQuery({
    queryKey: formDetailKey(code),
    queryFn: () => apiFetch<FormDetail>(formDetailPath(code)),
  });
}

/**
 * Gửi đơn mới lên máy chủ: câu trả lời và mọi tệp trong một lần; máy chủ sai một chỗ thì không lưu gì.
 * @param request        loại đơn, câu trả lời (tệp mang id tạm), ô cam đoan
 * @param filesByTempId  nội dung các tệp theo id tạm trong câu trả lời
 * @returns              dòng tóm tắt của đơn mới, có mã đơn; lỗi thì ném ApiError kèm câu báo
 */
export function submitForm(request: SubmitFormRequest, filesByTempId: ReadonlyMap<string, File>): Promise<FormSummary> {
  const body = new FormData();
  body.append(SUBMIT_FORM_FIELDS.request, JSON.stringify(request));
  filesByTempId.forEach((file, tempId) => body.append(tempId, file, file.name));
  return apiFetch<FormSummary>(ENDPOINTS.forms.submit, { method: 'POST', body });
}
