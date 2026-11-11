/* Một câu hỏi trong trình soạn (như questionEditor() của artifact/js/forms-page.js): khung riêng có thanh tiêu đề
   (số thứ tự · loại câu hỏi · Bắt buộc · nút đưa lên / xuống / nhân bản / xóa), các ô có nhãn,
   khối cài đặt riêng theo loại câu hỏi, công tắc Bắt buộc trả lời và ô "Mã dùng trong file Word".
   Khối thông báo chỉ có nội dung (soạn như Notion) và màu nền. */
import {
  FORM_TYPE_ISSUE_TARGET,
  INFO_BLOCK_COLORS,
  INFO_BLOCK_COLOR_LABEL,
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  questionTag,
  type AnswerableQuestion,
  type InfoBlockColor,
  type Question,
  type QuestionType,
} from '@ulaw/shared';
import { Field } from '../../components/Field';
import { RichTextEditor } from '../../components/rich-text/RichTextEditor';
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
        {/* Bên trái: nội dung câu hỏi (khối thông báo: nội dung thông báo, soạn như Notion); bên phải: loại câu hỏi */}
        <div className={styles.questionRow}>
          {question.type === 'info' ? (
            <div className={styles.richField}>
              <span>Nội dung thông báo</span>
              <RichTextEditor
                value={question.content}
                onChange={(content) => onChange({ ...question, content })}
                label="Nội dung thông báo"
                placeholder="Nội dung thông báo, hướng dẫn cho người nộp đơn. Gõ # để làm tiêu đề, - để gạch đầu dòng."
              />
            </div>
          ) : (
            <Field label="Nội dung câu hỏi" required>
              <GrowingTextarea
                className={`${styles.growing} ${styles.questionLabel}`}
                value={question.label}
                aria-invalid={invalidTargets.has(FORM_TYPE_ISSUE_TARGET.questionLabel(question.id)) || undefined}
                placeholder="VD: Lí do xin miễn"
                autoFocus={autoFocus}
                onValueChange={(label) => onChange({ ...question, label })}
              />
            </Field>
          )}
          <div className={styles.typeColumn}>
            <Field label="Loại câu hỏi">
              <select value={question.type} onChange={(event) => onChange(changeQuestionType(question, event.target.value as QuestionType))}>
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {QUESTION_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </Field>
            {question.type === 'info' && <InfoColorPicker color={question.color ?? 'gray'} onChange={(color) => onChange({ ...question, color })} />}
          </div>
        </div>

        {/* Mô tả ngắn cho người nộp đơn (khối thông báo không có, nội dung đã là phần thông báo) */}
        {question.type !== 'info' && (
          <Field label="Mô tả ngắn, gợi ý cho người nộp đơn">
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
            <TagField question={question} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Chọn màu nền của khối thông báo (bộ màu có sẵn).
 * @param color     màu đang chọn
 * @param onChange  gọi với màu mới
 * @returns         nhóm nút chọn màu, mỗi nút một ô màu
 */
function InfoColorPicker({ color, onChange }: { color: InfoBlockColor; onChange: (nextColor: InfoBlockColor) => void }) {
  return (
    <div className={styles.richField} role="radiogroup" aria-label="Màu nền khối thông báo">
      <span>Màu nền</span>
      <div className={styles.swatches}>
        {INFO_BLOCK_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === color}
            aria-label={INFO_BLOCK_COLOR_LABEL[option]}
            title={INFO_BLOCK_COLOR_LABEL[option]}
            className={styles.swatch}
            style={{ background: `var(--note-${option})` }}
            onClick={() => onChange(option)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Câu giải thích ô mã theo loại câu hỏi (như TAG_HELP của artifact/js/forms-page.js).
 * @param type  loại câu hỏi
 * @param tag   mã đang dùng (mã riêng, hoặc mã tự lấy theo nội dung câu hỏi)
 * @returns     câu giải thích
 */
function tagHelp(type: AnswerableQuestion['type'], tag: string): string {
  if (type === 'table') {
    return `Mã của cả bảng. Trong file Word, gõ {#${tag}} ở ô đầu và {/${tag}} ở ô cuối của một dòng mẫu; khi xuất file, đơn có bao nhiêu dòng thì bảng có bấy nhiêu dòng. Mỗi cột có mã riêng, hiện dưới tên cột.`;
  }
  if (type === 'check') return `Chỗ nào trong file Word có {${tag}} sẽ được điền các lựa chọn, nối bằng dấu phẩy.`;
  if (type === 'file') return `Chỗ nào trong file Word có {${tag}} sẽ được điền tên các tệp đã tải lên.`;
  return `Chỗ nào trong file Word có {${tag}} sẽ được điền câu trả lời của câu này.`;
}

/**
 * Ô "Mã dùng trong file Word" (như tagField() của bản mẫu): gõ chỉ nhận chữ thường không dấu, số, dấu _;
 * bỏ trống thì dùng mã tự lấy theo nội dung câu hỏi (hiện mờ trong ô).
 * @param question  câu hỏi cần trả lời
 * @param onChange  gọi với câu hỏi đã sửa mã
 * @returns         ô nhập mã kèm câu giải thích
 */
function TagField({ question, onChange }: { question: AnswerableQuestion; onChange: (nextQuestion: Question) => void }) {
  const invalid = useDraftIssues().has(FORM_TYPE_ISSUE_TARGET.questionTag(question.id));
  const autoTag = questionTag({ label: question.label });

  // Bỏ ký tự không hợp lệ ngay khi gõ; ô trống thì xóa mã riêng
  const changeTag = (typedText: string) => {
    const tag = typedText.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const { tag: _oldTag, ...withoutTag } = question;
    onChange(tag ? { ...question, tag } : withoutTag);
  };

  return (
    <div className={styles.tagField}>
      <label className={styles.tagRow}>
        <span>Mã dùng trong file Word</span>
        <span className={styles.tagInput}>
          <span aria-hidden="true">{'{'}</span>
          <input
            value={question.tag ?? ''}
            placeholder={autoTag}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={invalid || undefined}
            onChange={(event) => changeTag(event.target.value)}
          />
          <span aria-hidden="true">{'}'}</span>
        </span>
      </label>
      <small>{tagHelp(question.type, questionTag(question))} Bỏ trống thì tự lấy theo nội dung câu hỏi.</small>
    </div>
  );
}
