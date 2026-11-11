/* Ô trả lời một giá trị: trả lời ngắn, đoạn văn, số, ngày, danh sách thả xuống. */
import { DateInput } from '../../components/DateInput';
import { formatDate } from '../../lib/format';
import type { AnswerProps } from './answerProps';
import styles from './FormRenderer.module.css';

type SimpleType = 'text' | 'para' | 'number' | 'date' | 'select';

/**
 * Câu trả lời để hiện ở chế độ chỉ xem.
 * @param type         loại câu hỏi
 * @param answerValue  câu trả lời
 * @returns            chữ để hiện; chưa trả lời thì null
 */
function readOnlyText(type: SimpleType, answerValue: unknown): string | null {
  if (type === 'number') return typeof answerValue === 'number' ? answerValue.toLocaleString('vi-VN') : null;
  if (typeof answerValue !== 'string' || !answerValue.trim()) return null;
  return type === 'date' ? formatDate(answerValue) : answerValue;
}

/**
 * Ô trả lời một giá trị. Chỉ xem thì hiện câu trả lời dạng chữ ("—" khi chưa trả lời).
 * Câu trả lời lưu: chữ (ngày dạng 'YYYY-MM-DD'), số thì số hoặc null khi để trống.
 * @returns  ô nhập (input / textarea / select), hoặc đoạn chữ khi chỉ xem
 */
export function SimpleAnswer({
  question,
  answerValue,
  onAnswerChange,
  readOnly,
  invalid,
  labelId,
  describedBy,
}: AnswerProps<SimpleType>) {
  // Chỉ xem
  if (readOnly) {
    const text = readOnlyText(question.type, answerValue);
    return text === null ? <p className={styles.emptyValue}>—</p> : <p className={styles.readValue}>{text}</p>;
  }

  // Thuộc tính chung của các ô nhập
  const inputProps = {
    'aria-labelledby': labelId,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
    'aria-required': question.required || undefined,
    className: invalid ? styles.invalid : undefined,
  };
  const textValue = typeof answerValue === 'string' ? answerValue : '';

  switch (question.type) {
    case 'para':
      return <textarea rows={4} value={textValue} onChange={(event) => onAnswerChange(event.target.value)} {...inputProps} />;
    case 'number':
      return (
        <input
          type="number"
          inputMode="decimal"
          value={typeof answerValue === 'number' ? answerValue : ''}
          onChange={(event) => onAnswerChange(event.target.value === '' ? null : Number(event.target.value))}
          {...inputProps}
        />
      );
    case 'date':
      // Ngày gõ dở cũng lưu lại, để khi kiểm tra báo "Ngày không hợp lệ."
      return <DateInput value={textValue} onValueChange={onAnswerChange} {...inputProps} />;
    case 'select':
      return (
        <select value={textValue} onChange={(event) => onAnswerChange(event.target.value)} {...inputProps}>
          <option value="">Chọn…</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    default:
      return <input type="text" value={textValue} onChange={(event) => onAnswerChange(event.target.value)} {...inputProps} />;
  }
}
