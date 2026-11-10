/* Ô trả lời chọn một (radio) và chọn nhiều (check). */
import { useId } from 'react';
import type { AnswerProps } from './answerProps';
import styles from './FormRenderer.module.css';

/**
 * Danh sách lựa chọn, mỗi lựa chọn một khung bấm được; khung đang chọn tô xanh nhạt.
 * Chỉ xem thì vẫn hiện đủ lựa chọn (để thấy đã chọn gì trong số nào) nhưng không bấm được.
 * Câu trả lời lưu: chọn một → chuỗi ("" = chưa chọn) · chọn nhiều → mảng các lựa chọn.
 * @returns  nhóm ô radio / checkbox
 */
export function ChoiceAnswer({
  question,
  answerValue,
  onAnswerChange,
  readOnly,
  invalid,
  labelId,
  describedBy,
}: AnswerProps<'radio' | 'check'>) {
  const groupName = useId();
  const multiple = question.type === 'check';
  const chosen = multiple
    ? Array.isArray(answerValue)
      ? (answerValue as unknown[]).filter((choice): choice is string => typeof choice === 'string')
      : []
    : typeof answerValue === 'string'
      ? [answerValue]
      : [];

  /**
   * Bấm vào một lựa chọn.
   * @param option   lựa chọn được bấm
   * @param checked  ô đó đang được đánh dấu chưa (sau khi bấm)
   */
  const toggle = (option: string, checked: boolean) => {
    if (!multiple) {
      onAnswerChange(option);
      return;
    }
    // Chọn nhiều: giữ thứ tự như trong danh sách lựa chọn
    const nextChosen = checked ? [...chosen, option] : chosen.filter((choice) => choice !== option);
    onAnswerChange(question.options.filter((candidate) => nextChosen.includes(candidate)));
  };

  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-required={question.required || undefined}
      className={`${styles.choices} ${invalid ? styles.invalid : ''} ${readOnly ? styles.choicesReadOnly : ''}`}
    >
      {question.options.map((option) => (
        <label key={option} className={styles.choice}>
          <input
            type={multiple ? 'checkbox' : 'radio'}
            name={groupName}
            value={option}
            checked={chosen.includes(option)}
            disabled={readOnly}
            onChange={(event) => toggle(option, event.target.checked)}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}
