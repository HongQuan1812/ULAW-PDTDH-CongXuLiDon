/* Hàng nút dính đáy của trang đơn: ô cam đoan bên trái, các nút bên phải.
   Dùng chung cho trang nộp đơn mới (Hủy / Gửi đơn) và trang chi tiết đơn khi sửa được (Bỏ thay đổi / Lưu thay đổi, chỉ hiện khi đã sửa). */
import { useRef, useState, type ReactNode } from 'react';
import { ANSWER_MESSAGES, type AnswersValidation } from '@ulaw/shared';
import type { ToastTone } from '../../components/Toast';
import { focusFirstError } from '../../features/form-renderer/FormSections';
import styles from './FormPage.module.css';

/** Câu cam đoan ở cuối lá đơn. */
const COMMITMENT_TEXT = 'Tôi cam đoan các thông tin và minh chứng trên là đúng sự thật.';

/**
 * Trạng thái ô cam đoan: đã đánh dấu chưa, có đang tô đỏ không.
 * @param initiallyCommitted  đánh dấu sẵn hay không (vd nháp đơn mới đang soạn)
 * @returns  committed · showError: đang tô đỏ · inputRef: để đưa con trỏ tới ô ·
 *           changeCommitment(checked): đánh dấu / bỏ đánh dấu (đã đánh dấu thì hết tô đỏ) · setShowError
 */
export function useCommitment(initiallyCommitted = false) {
  const [committed, setCommitted] = useState(initiallyCommitted);
  const [showError, setShowError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const changeCommitment = (checked: boolean) => {
    setCommitted(checked);
    if (checked) setShowError(false);
  };

  return { committed, showError, setShowError, inputRef, changeCommitment };
}

export type CommitmentState = ReturnType<typeof useCommitment>;

/**
 * Kiểm tra lá đơn và ô cam đoan trước khi gửi. Còn lỗi thì: lỗi hiện dưới từng câu, ô cam đoan tô đỏ nếu chưa đánh dấu,
 * toast đỏ ghi các phần cần xem lại (và nhắc cam đoan), con trỏ tới chỗ lỗi đầu tiên.
 * @param validate    hàm kiểm tra cả lá đơn (useFormAnswers().validate)
 * @param commitment  trạng thái ô cam đoan (useCommitment)
 * @param toast       hàm hiện toast
 * @returns           true nếu gửi được
 */
export function checkBeforeSending(
  validate: () => AnswersValidation,
  commitment: CommitmentState,
  toast: (message: string, tone?: ToastTone) => void,
): boolean {
  // Kiểm tra câu trả lời và ô cam đoan
  const validation = validate();
  const { invalidSectionTitles } = validation;
  commitment.setShowError(!commitment.committed);
  if (!invalidSectionTitles.length && commitment.committed) return true;

  // Có lỗi: gộp các câu báo vào một toast, đưa con trỏ tới câu lỗi đầu tiên (không có thì tới ô cam đoan)
  const errorMessages = [
    invalidSectionTitles.length ? ANSWER_MESSAGES.sectionsToCheck(invalidSectionTitles) : '',
    commitment.committed ? '' : ANSWER_MESSAGES.commitmentRequired,
  ];
  toast(errorMessages.filter(Boolean).join(' '), 'error');
  if (invalidSectionTitles.length) focusFirstError(validation.questionErrors);
  else commitment.inputRef.current?.focus();
  return false;
}

/**
 * Hàng nút dính đáy màn hình khi cuộn: ô cam đoan bên trái, các nút bên phải.
 * @param commitment  trạng thái ô cam đoan (useCommitment)
 * @param children    các nút, vd Hủy và Gửi đơn
 * @returns           khối hàng nút
 */
export function SubmitBar({ commitment, children }: { commitment: CommitmentState; children: ReactNode }) {
  return (
    // data-avoid-floating-button: các nút tròn nổi (Ghi chú nội bộ…) không che thanh này (đứng lên trên khi chồng nhau)
    <div className={styles.submitRow} data-avoid-floating-button>
      <label className={`${styles.commitment} ${commitment.showError ? styles.commitmentInvalid : ''}`}>
        <input
          ref={commitment.inputRef}
          type="checkbox"
          checked={commitment.committed}
          aria-invalid={commitment.showError || undefined}
          onChange={(event) => commitment.changeCommitment(event.target.checked)}
        />
        <span>{COMMITMENT_TEXT}</span>
      </label>
      <div className={styles.buttons}>{children}</div>
    </div>
  );
}
