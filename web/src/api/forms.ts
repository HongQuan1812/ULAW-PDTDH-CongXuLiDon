/* Hook gọi API lá đơn. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  SUBMIT_FORM_FIELDS,
  formDecisionPath,
  formDetailPath,
  formReceivePath,
  type DecideFormRequest,
  type FormDetail,
  type FormSummary,
  type HandledFormsResponse,
  type MyFormsResponse,
  type SubmitFormRequest,
  type UpdateFormRequest,
} from '@ulaw/shared';
import { ApiError, apiFetch } from './client';

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
 * Tiếp nhận một lá đơn (cán bộ). Thành công thì trang chi tiết dùng ngay lá đơn máy chủ trả về, các bảng đơn tải lại.
 * Đơn không còn chờ tiếp nhận (vd cán bộ khác vừa tiếp nhận) hoặc không còn thì tải lại đơn để trang hiện đúng trạng thái.
 * @param code  mã đơn
 * @returns     kết quả useMutation; gọi mutate(). data = lá đơn sau khi tiếp nhận
 */
export function useReceiveForm(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<FormDetail>(formReceivePath(code), { method: 'POST' }),
    onSuccess: (receivedForm) => {
      queryClient.setQueryData(formDetailKey(code), receivedForm);
      void queryClient.invalidateQueries({ queryKey: MY_FORMS_KEY });
      void queryClient.invalidateQueries({ queryKey: HANDLED_FORMS_KEY });
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        void queryClient.invalidateQueries({ queryKey: formDetailKey(code) });
      }
    },
  });
}

/**
 * Ra quyết định về một đơn Đang xét (cán bộ): Yêu cầu bổ sung, Duyệt hoặc Từ chối. Thành công thì trang chi tiết dùng ngay lá đơn
 * máy chủ trả về, các bảng đơn tải lại. Đơn không còn Đang xét (vd cán bộ khác vừa xử lí) hoặc không còn thì tải lại đơn để trang hiện đúng trạng thái.
 * @param code  mã đơn
 * @returns     kết quả useMutation; gọi mutate({ decision, note }). data = lá đơn sau khi ra quyết định
 */
export function useDecideForm(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decideRequest: DecideFormRequest) =>
      apiFetch<FormDetail>(formDecisionPath(code), { method: 'POST', body: JSON.stringify(decideRequest) }),
    onSuccess: (decidedForm) => {
      queryClient.setQueryData(formDetailKey(code), decidedForm);
      void queryClient.invalidateQueries({ queryKey: MY_FORMS_KEY });
      void queryClient.invalidateQueries({ queryKey: HANDLED_FORMS_KEY });
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        void queryClient.invalidateQueries({ queryKey: formDetailKey(code) });
      }
    },
  });
}

/**
 * Gửi đơn mới lên máy chủ: câu trả lời và mọi tệp trong một lần; máy chủ sai một chỗ thì không lưu gì.
 * @param request        loại đơn, câu trả lời (tệp mang id tạm), ô cam đoan
 * @param filesByTempId  nội dung các tệp theo id tạm trong câu trả lời
 * @returns              dòng tóm tắt của đơn mới, có mã đơn; lỗi thì ném ApiError kèm câu báo
 */
export function submitForm(request: SubmitFormRequest, filesByTempId: ReadonlyMap<string, File>): Promise<FormSummary> {
  return apiFetch<FormSummary>(ENDPOINTS.forms.submit, { method: 'POST', body: multipartBody(request, filesByTempId) });
}

/**
 * Lưu nội dung đã sửa của một lá đơn: câu trả lời và tệp mới trong một lần; máy chủ sai một chỗ thì không lưu gì.
 * @param code           mã đơn
 * @param request        câu trả lời (tệp giữ lại mang id ở máy chủ, tệp mới mang id tạm), ô cam đoan
 * @param filesByTempId  nội dung các tệp mới theo id tạm
 * @returns              lá đơn sau khi lưu; lỗi thì ném ApiError kèm câu báo
 */
export function updateForm(code: string, request: UpdateFormRequest, filesByTempId: ReadonlyMap<string, File>): Promise<FormDetail> {
  return apiFetch<FormDetail>(formDetailPath(code), { method: 'PUT', body: multipartBody(request, filesByTempId) });
}

/**
 * Body multipart của POST /forms và PUT /forms/:code: phần chữ (JSON) và mỗi tệp một trường tên bằng id tạm.
 * @param request        phần chữ
 * @param filesByTempId  nội dung tệp theo id tạm
 * @returns              FormData để gửi
 */
function multipartBody(request: SubmitFormRequest | UpdateFormRequest, filesByTempId: ReadonlyMap<string, File>): FormData {
  const body = new FormData();
  body.append(SUBMIT_FORM_FIELDS.request, JSON.stringify(request));
  filesByTempId.forEach((file, tempId) => body.append(tempId, file, file.name));
  return body;
}
