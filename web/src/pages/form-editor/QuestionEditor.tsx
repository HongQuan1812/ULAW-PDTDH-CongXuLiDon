/* Một câu hỏi trong trình soạn (như questionEditor() của artifact/js/forms-page.js): khung riêng có thanh tiêu đề
   (số thứ tự · loại câu hỏi · Bắt buộc · nút đưa lên / xuống / nhân bản / xóa), các ô có nhãn,
   khối cài đặt riêng theo loại câu hỏi, công tắc Bắt buộc trả lời. Khối thông báo chỉ có tiêu đề và nội dung. */
import { FORM_TYPE_ISSUE_TARGET, QUESTION_TYPES, QUESTION_TYPE_LABEL, type Question, type QuestionType } from '@ulaw/shared';
import { Field } from '../../components/Field';
import { GrowingTextarea } from '../../features/form-renderer/GrowingTextarea';
import { useDraftIssues } from './draftIssues';
import { EditorIconButton } from './EditorIconButton';
import { changeQuestionType } from './formTypeDraft';
import { QuestionSettings } from './QuestionSettings';
import styles from './FormTypeEditor.module.css';

/** Việc làm với cả câu hỏi, do phần chứa câu hỏi thực hiện. */
export type QuestionAction = 'moveUp' | 'moveDown' | 'duplicate' | 'delete';

interface QuestionEditorProps {
  question: Question;
  /** Vị trí trong phần, đếm từ 0 */
  index: number;
  /** Số câu hỏi của phần, để khóa nút đưa xuống ở câu cuối */
  questionCount: number;
  /** Đưa con trỏ vào ô nội dung ngay khi hiện (câu hỏi vừa thêm) */
  autoFocus: boolean;
  onChange: (nextQuestion: Question) => void;
  onAction: (action: QuestionAction) => void;
}

/**
 * Khung soạn một câu hỏi.
 * @param props  xem QuestionEditorProps
 * @returns      khung câu hỏi
 */
export function QuestionEditor({ question, index, questionCount, autoFocus, onChange, onAction }: QuestionEditorProps) {
  const isInfo = question.type === 'info';
  const required = 'required' in question && question.required;
  const invalidTargets = useDraftIssues();

  return (
    <div className={`${styles.question} ${isInfo ? styles.infoBlock : ''}`}>
      <div className={styles.questionHead}>
        <span className={styles.questionNumber}>{isInfo ? 'Khối thông báo' : `Câu hỏi ${index + 1}`}</span>
        {!isInfo && <span className={styles.badge}>{QUESTION_TYPE_LABEL[question.type]}</span>}
        {required && <span className={styles.requiredBadge}>Bắt buộc</span>}
        <div className={styles.iconActions}>
          <EditorIconButton icon="up" label="Đưa câu hỏi lên" disabled={index === 0} onClick={() => onAction('moveUp')} />
          <EditorIconButton icon="down" label="Đưa câu hỏi xuống" disabled={index === questionCount - 1} onClick={() => onAction('moveDown')} />
          <EditorIconButton icon="copy" label="Nhân bản câu hỏi" onClick={() => onAction('duplicate')} />
          <EditorIconButton icon="delete" label="Xóa câu hỏi" onClick={() => onAction('delete')} />
        </div>
      </div>

      <div className={styles.questionBody}>
        {/* Nội dung câu hỏi (khối thông báo: tiêu đề khối) và loại câu hỏi */}
        <div className={styles.questionRow}>
          <Field label={isInfo ? 'Tiêu đề khối' : 'Nội dung câu hỏi'} optional={isInfo}>
            <GrowingTextarea
              className={`${styles.growing} ${styles.questionLabel}`}
              value={question.label}
              aria-invalid={invalidTargets.has(FORM_TYPE_ISSUE_TARGET.questionLabel(question.id)) || undefined}
              placeholder={isInfo ? 'VD: Lưu ý khi nộp đơn' : 'VD: Lí do xin miễn'}
              autoFocus={autoFocus}
              onValueChange={(label) => onChange({ ...question, label })}
            />
          </Field>
          <Field label="Loại câu hỏi">
            <select value={question.type} onChange={(event) => onChange(changeQuestionType(question, event.target.value as QuestionType))}>
              {QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {QUESTION_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Mô tả cho người nộp đơn (khối thông báo: nội dung thông báo) */}
        {isInfo ? (
          <Field label="Nội dung thông báo">
            <textarea
              rows={3}
              value={question.help ?? ''}
              placeholder="Nội dung thông báo, hướng dẫn cho người nộp đơn"
              onChange={(event) => onChange({ ...question, help: event.target.value })}
            />
          </Field>
        ) : (
          <Field label="Mô tả, gợi ý cho người nộp đơn" optional>
            <GrowingTextarea
              className={styles.growing}
              value={question.help ?? ''}
              placeholder="VD: Ghi rõ học kỳ và năm học"
              onValueChange={(help) => onChange({ ...question, help })}
            />
          </Field>
        )}

        <QuestionSettings question={question} onChange={onChange} />

        {!isInfo && (
          <div className={styles.questionFoot}>
            <label className={styles.switch}>
              <input type="checkbox" checked={required} onChange={(event) => onChange({ ...question, required: event.target.checked })} />
              <span>Bắt buộc trả lời</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
