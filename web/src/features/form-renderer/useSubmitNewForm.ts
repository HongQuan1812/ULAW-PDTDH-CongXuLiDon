/* Gửi lá đơn mới: câu trả lời và mọi tệp vừa chọn đi cùng một lần. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FormAnswers, FormSummary, FormType } from '@ulaw/shared';
import { submitForm } from '../../api/form';
import { MY_FORMS_KEY } from '../../api/forms';
import { collectLocalFiles } from './localFiles';

/**
 * Gửi lá đơn mới của một loại đơn: của mình, hoặc thay cho người khác (Admin).
 * Thành công thì bảng "Đơn đã nộp" (của mình / của người đó) và các bảng đơn của cán bộ tải lại để có đơn mới.
 * @param formType     loại đơn đang nộp
 * @param applicantId  nộp thay: id người nộp đơn; bỏ trống = đơn của mình
 * @returns            kết quả useMutation; gọi mutate({ answers, committed }). data = dòng tóm tắt của đơn mới (có mã đơn)
 */
export function useSubmitNewForm(formType: FormType, applicantId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ answers, committed }: { answers: FormAnswers; committed: boolean }): Promise<FormSummary> =>
      submitForm({ formTypeId: formType.id, answers, committed, applicantId }, collectLocalFiles(formType.sections, answers)),
    onSuccess: () =>
      applicantId
        ? Promise.all([
            queryClient.invalidateQueries({ queryKey: ['profile', 'person', applicantId] }),
            queryClient.invalidateQueries({ queryKey: ['forms'] }),
          ])
        : queryClient.invalidateQueries({ queryKey: MY_FORMS_KEY }),
  });
}
