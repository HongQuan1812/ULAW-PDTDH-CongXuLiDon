/* Lưu nội dung đã sửa của một lá đơn: câu trả lời và mọi tệp vừa chọn đi cùng một lần. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FormAnswers, FormDetail } from '@ulaw/shared';
import { HANDLED_FORMS_KEY, MY_FORMS_KEY, formDetailKey, updateForm } from '../../api/forms';
import { ApiError } from '../../api/client';
import { collectLocalFiles } from './localFiles';

/**
 * Lưu thay đổi của một lá đơn. Thành công thì trang chi tiết dùng ngay lá đơn máy chủ trả về,
 * các bảng đơn tải lại (trạng thái có thể đổi từ Cần bổ sung sang Đã bổ sung). Đơn vừa bị khóa thì tải lại đơn.
 * @param form  lá đơn đang sửa (cần code, sections)
 * @returns     kết quả useMutation; gọi mutate({ answers, committed }). data = lá đơn sau khi lưu
 */
export function useSaveFormChanges(form: Pick<FormDetail, 'code' | 'sections'>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ answers, committed }: { answers: FormAnswers; committed: boolean }): Promise<FormDetail> =>
      updateForm(form.code, { answers, committed }, collectLocalFiles(form.sections, answers)),
    onSuccess: (savedForm) => {
      queryClient.setQueryData(formDetailKey(form.code), savedForm);
      void queryClient.invalidateQueries({ queryKey: MY_FORMS_KEY });
      void queryClient.invalidateQueries({ queryKey: HANDLED_FORMS_KEY });
    },
    // Đơn vừa bị khóa (vd cán bộ đã tiếp nhận) hoặc không còn: tải lại đơn để trang hiện đúng trạng thái mới
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        void queryClient.invalidateQueries({ queryKey: formDetailKey(form.code) });
      }
    },
  });
}
