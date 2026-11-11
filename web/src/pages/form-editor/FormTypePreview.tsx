/* Tab "Xem trước" của trình soạn loại đơn (như renderPreview() của artifact/js/forms-page.js):
   vẽ lá đơn đúng như người nộp đơn sẽ thấy, thử điền và kiểm tra được, không lưu gì. */
import { ANSWER_MESSAGES } from '@ulaw/shared';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { FormSections, focusFirstError } from '../../features/form-renderer/FormSections';
import { useFormAnswers } from '../../features/form-renderer/useFormAnswers';
import type { FormTypeDraft } from './formTypeDraft';
import styles from './FormTypeEditor.module.css';

/** Câu báo khi thử kiểm tra mà mọi câu trả lời đều hợp lệ. */
const VALID_ANSWERS_TEXT = 'Các câu trả lời hợp lệ.';

/**
 * Bản xem trước của loại đơn đang soạn. Câu trả lời thử chỉ giữ trong tab này: rời tab là bỏ.
 * @param draft  bản đang soạn (kể cả phần chưa lưu)
 * @returns      khung báo xem trước, tên và mô tả loại đơn, các phần, nút thử kiểm tra
 */
export function FormTypePreview({ draft }: { draft: FormTypeDraft }) {
  const { answers, setAnswer, questionErrors, validate } = useFormAnswers(draft.sections);
  const toast = useToast();

  /**
   * Kiểm tra cả lá đơn như khi gửi: lỗi hiện dưới từng câu, toast đỏ ghi các phần cần xem lại,
   * con trỏ tới câu lỗi đầu tiên; không lỗi thì toast xanh.
   */
  const checkAnswers = () => {
    const validation = validate();
    const { invalidSectionTitles } = validation;
    if (!invalidSectionTitles.length) {
      toast(VALID_ANSWERS_TEXT, 'success');
      return;
    }
    toast(ANSWER_MESSAGES.sectionsToCheck(invalidSectionTitles), 'error');
    focusFirstError(validation.questionErrors);
  };

  return (
    <div className={styles.preview}>
      {/* Tên và mô tả loại đơn (khung báo "Đây là bản xem trước" nằm ở đầu trang trình soạn) */}
      <div className={styles.previewIntro}>
        <h2 className={styles.title}>{draft.name.trim() || 'Loại đơn chưa có tên'}</h2>
        {draft.description.trim() && <p className={styles.hint}>{draft.description}</p>}
      </div>

      {/* Các phần, điền thử được */}
      <FormSections sections={draft.sections} answers={answers} onAnswerChange={setAnswer} questionErrors={questionErrors} />

      {/* Nút thử kiểm tra, bên phải */}
      <div className={styles.previewCheck}>
        <Button variant="primary" onClick={checkAnswers}>
          Thử kiểm tra câu trả lời
        </Button>
      </div>
    </div>
  );
}
