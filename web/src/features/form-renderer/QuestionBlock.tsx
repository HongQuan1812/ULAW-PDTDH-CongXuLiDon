/* Một câu hỏi: nhãn (dấu * nếu bắt buộc), mô tả, ô trả lời theo loại câu hỏi, câu báo lỗi (như renderQuestion của artifact/js/sections.js). */
import { useId } from 'react';
import type { AnswerValue, Question, QuestionOf } from '@ulaw/shared';
import { ChoiceAnswer } from './ChoiceAnswer';
import { FileAnswer } from './FileAnswer';
import { SimpleAnswer } from './SimpleAnswer';
import { TableAnswer } from './TableAnswer';
import styles from './FormRenderer.module.css';

interface QuestionBlockProps {
  question: Question;
  /** Câu trả lời hiện tại */
  answerValue: AnswerValue | undefined;
  /** Đổi câu trả lời của câu hỏi này */
  onAnswerChange: (questionId: string, answerValue: AnswerValue) => void;
  /** true: chỉ xem */
  readOnly: boolean;
  /** Câu báo lỗi; trống = không lỗi */
  error: string | undefined;
}

/**
 * Vẽ một câu hỏi. Khối thông báo chỉ có tiêu đề và nội dung, không có ô trả lời.
 * @returns  khối câu hỏi; mang data-question-id để tìm câu bị lỗi đầu tiên (focusFirstError)
 */
export function QuestionBlock({ question, answerValue, onAnswerChange, readOnly, error }: QuestionBlockProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const helpId = `${baseId}-help`;
  const errorId = `${baseId}-error`;

  // Khối thông báo
  if (question.type === 'info') {
    return (
      <div className={styles.question} data-question-id={question.id}>
        {question.label && <p className={styles.questionLabel}>{question.label}</p>}
        {question.help && <p className={styles.infoBlock}>{question.help}</p>}
      </div>
    );
  }

  // Thuộc tính chung truyền cho ô trả lời
  const describedBy = [question.help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  const common = {
    answerValue,
    onAnswerChange: (nextAnswer: AnswerValue) => onAnswerChange(question.id, nextAnswer),
    readOnly,
    invalid: Boolean(error),
    labelId,
    describedBy,
  };

  return (
    <div className={styles.question} data-question-id={question.id}>
      <p id={labelId} className={styles.questionLabel}>
        {question.label || 'Câu hỏi chưa có tên'}
        {question.required && (
          <>
            <span className={styles.required} aria-hidden="true">
              {' '}*
            </span>
            <span className="sr-only"> (bắt buộc)</span>
          </>
        )}
      </p>
      {question.help && (
        <p id={helpId} className={styles.hint}>
          {question.help}
        </p>
      )}

      {/* Chọn một / chọn nhiều / danh sách dùng chung một schema (type là enum), nên phải ép kiểu sau khi đã xét type */}
      {question.type === 'radio' || question.type === 'check' ? (
        <ChoiceAnswer question={question as QuestionOf<'radio' | 'check'>} {...common} />
      ) : question.type === 'table' ? (
        <TableAnswer question={question} {...common} />
      ) : question.type === 'file' ? (
        <FileAnswer question={question} {...common} />
      ) : (
        <SimpleAnswer question={question as QuestionOf<'text' | 'para' | 'number' | 'date' | 'select'>} {...common} />
      )}

      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
