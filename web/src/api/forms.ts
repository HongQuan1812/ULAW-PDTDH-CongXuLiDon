/* Hook gọi API lá đơn. */
import { useQuery } from '@tanstack/react-query';
import {
  ENDPOINTS,
  SUBMIT_FORM_FIELDS,
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
