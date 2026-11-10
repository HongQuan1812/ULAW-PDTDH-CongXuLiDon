/* Trang nộp đơn mới của một loại đơn (#/nop-don/<mã loại đơn>), mở sau khi chọn trong hộp "Chọn loại đơn".
   Bước này mới vẽ nội dung đơn và kiểm tra câu trả lời; ô cam đoan, khung thông tin đơn và gửi đơn lên máy chủ làm tiếp sau. */
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ANSWER_MESSAGES, type FormType } from '@ulaw/shared';
import { useFormType } from '../../api/form-types';
import { PAGE_PATH } from '../../app/paths';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { FormSections, focusFirstError } from '../../features/form-renderer/FormSections';
import { useFormAnswers } from '../../features/form-renderer/useFormAnswers';
import { SHOW_DEMO } from '../../lib/env';
import styles from './NewFormPage.module.css';

/** Câu báo khi không tải được loại đơn mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const LOAD_FAILED_TEXT = 'Không tải được loại đơn.';

/**
 * Về trang trước (như nút Back); mở thẳng trang này (không có trang trước) thì về trang Thông tin cá nhân.
 * @returns  hàm quay lại
 */
function useGoBack() {
  const navigate = useNavigate();
  const location = useLocation();
  return () => (location.key === 'default' ? navigate(PAGE_PATH.profile) : navigate(-1));
}

/**
 * Tải cấu trúc loại đơn rồi vẽ trang nộp đơn.
 * @returns  giao diện trang: đang tải / câu báo lỗi kèm nút ↻ / lá đơn
 */
export function NewFormPage() {
  const { formTypeId = '' } = useParams();
  const formTypeQuery = useFormType(formTypeId);
  const goBack = useGoBack();

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={goBack}>
        ‹ Quay lại
      </button>
      {formTypeQuery.isPending ? (
        <p className={styles.muted}>Đang tải loại đơn…</p>
      ) : formTypeQuery.data ? (
        <NewForm key={formTypeQuery.data.id} formType={formTypeQuery.data} onCancel={goBack} />
      ) : (
        <section className={styles.errorCard}>
          <LoadError message={loadErrorMessage(formTypeQuery) ?? LOAD_FAILED_TEXT} />
          <RefreshButton query={formTypeQuery} label="loại đơn" />
        </section>
      )}
    </div>
  );
}

/**
 * Lá đơn mới: tiêu đề, các phần câu hỏi, hàng nút Gửi đơn.
 * Bấm Gửi đơn: kiểm tra mọi câu, lỗi thì báo dưới từng câu và bằng toast, đưa con trỏ tới câu lỗi đầu tiên.
 * @param formType  loại đơn đủ cấu trúc
 * @param onCancel  bấm Hủy: rời trang
 * @returns         thẻ <form>
 */
function NewForm({ formType, onCancel }: { formType: FormType; onCancel: () => void }) {
  const toast = useToast();
  const { answers, setAnswer, questionErrors, validate } = useFormAnswers(formType.sections);
  const [previewReadOnly, setPreviewReadOnly] = useState(false);

  /**
   * Bấm Gửi đơn. Còn lỗi thì: lỗi hiện dưới từng câu, toast đỏ ghi các phần cần xem lại, con trỏ tới câu lỗi đầu tiên.
   * @param event  sự kiện gửi form (chặn để trang không tải lại)
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validate();
    if (validation.sectionErrors.length) {
      const invalidSectionTitles = formType.sections
        .filter((section) => section.questions.some((question) => question.id in validation.questionErrors))
        .map((section) => section.title);
      toast(ANSWER_MESSAGES.sectionsToCheck(invalidSectionTitles), 'error');
      focusFirstError(validation.questionErrors);
      return;
    }
    toast('Các câu trả lời đã hợp lệ. Phần gửi đơn lên máy chủ sẽ làm ở bước tiếp theo.', 'info');
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.head}>
        <h1 className={styles.title}>{formType.name}</h1>
        {formType.description && <p className={styles.muted}>{formType.description}</p>}
      </div>

      {/* JUST FOR DEMO: START · xem thử dạng chỉ xem của lá đơn (như ở trang chi tiết đơn đã khóa), chỉ hiện khi VITE_APP_ENV = "dev" */}
      {SHOW_DEMO && (
        <label className={styles.demoToggle}>
          <input type="checkbox" checked={previewReadOnly} onChange={(event) => setPreviewReadOnly(event.target.checked)} />
          Xem thử dạng chỉ xem
        </label>
      )}
      {/* JUST FOR DEMO: END */}

      <FormSections
        sections={formType.sections}
        answers={answers}
        onAnswerChange={setAnswer}
        questionErrors={questionErrors}
        readOnly={previewReadOnly}
      />

      {!previewReadOnly && (
        <div className={styles.submitRow}>
          <Button variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
          <Button variant="primary" type="submit">
            Gửi đơn
          </Button>
        </div>
      )}
    </form>
  );
}
