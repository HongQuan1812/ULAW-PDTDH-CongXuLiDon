/* Gửi lá đơn mới: câu trả lời và mọi tệp vừa chọn đi cùng một lần. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ANSWER_MESSAGES, type FileRef, type FormAnswers, type FormSummary, type FormType } from '@ulaw/shared';
import { MY_FORMS_KEY, submitForm } from '../../api/forms';
import { readLocalFile } from './localFiles';

/**
 * Lấy nội dung mọi tệp trong câu trả lời, để gửi kèm.
 * @param formType  loại đơn đang nộp
 * @param answers   câu trả lời trên trang
 * @returns         tệp theo id tạm; tệp không còn trong trình duyệt (vd đã tải lại trang) thì ném lỗi, không gửi gì
 */
function collectFiles(formType: FormType, answers: FormAnswers): Map<string, File> {
  const filesByTempId = new Map<string, File>();
  formType.sections
    .flatMap((section) => section.questions)
    .filter((question) => question.type === 'file')
    .forEach((question) => {
      const files = Array.isArray(answers[question.id]) ? (answers[question.id] as FileRef[]) : [];
      files.forEach((file) => {
        const content = readLocalFile(file.id);
        if (!content) throw new Error(ANSWER_MESSAGES.fileMissing(file.name));
        filesByTempId.set(file.id, content);
      });
    });
  return filesByTempId;
}

/**
 * Gửi lá đơn mới của một loại đơn. Thành công thì bảng "Đơn đã nộp" tải lại để có đơn mới.
 * @param formType  loại đơn đang nộp
 * @returns         kết quả useMutation; gọi mutate({ answers, committed }). data = dòng tóm tắt của đơn mới (có mã đơn)
 */
export function useSubmitNewForm(formType: FormType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ answers, committed }: { answers: FormAnswers; committed: boolean }): Promise<FormSummary> =>
      submitForm({ formTypeId: formType.id, answers, committed }, collectFiles(formType, answers)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_FORMS_KEY }),
  });
}
