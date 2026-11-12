/* Ô soạn một bức thư có mã {…}: hàng nút Mã chèn vào thư (trên cùng), Tiêu đề thư, Nội dung thư (trình soạn có định dạng).
   Bấm một nút mã thì chèn mã vào chỗ con trỏ của ô vừa gõ gần nhất (mặc định Nội dung thư).
   Cả hai ô tô màu mã (ô tự làm khi truyền danh sách mã): mã dùng được tô xanh, mã lạ tô đỏ. */
import { useRef } from 'react';
import { EMAIL_TAGS, EMAIL_TAG_LABEL, type EmailTag, type RichTextDoc } from '@ulaw/shared';
import { RequiredMark } from '../../components/Field';
import { RichTextEditor } from '../../components/rich-text/RichTextEditor';
import { TagTextInput } from '../../components/rich-text/TagTextInput';
import type { TagInsertControl } from '../../components/rich-text/tagHighlight';
import fieldStyles from '../../components/Field.module.css';
import styles from './EmailSettingsPage.module.css';

/** Ô vừa gõ gần nhất, nơi nút chèn mã chèn vào. */
type TextTarget = 'subject' | 'body';

interface EmailComposerProps {
  /** tiêu đề thư */
  subject: string;
  /** nội dung thư */
  body: RichTextDoc;
  /** câu báo lỗi của ô Tiêu đề thư; không lỗi thì undefined */
  subjectError?: string;
  /** câu báo lỗi của ô Nội dung thư; không lỗi thì undefined */
  bodyError?: string;
  /** sửa tiêu đề hoặc nội dung */
  onChange: (changes: { subject?: string; body?: RichTextDoc }) => void;
}

/**
 * Ô soạn thư: Mã chèn vào thư, Tiêu đề, Nội dung.
 * @param props  xem EmailComposerProps
 * @returns      ba mục xếp dọc
 */
export function EmailComposer({ subject, body, subjectError, bodyError, onChange }: EmailComposerProps) {
  const subjectControlRef = useRef<TagInsertControl | null>(null);
  const bodyControlRef = useRef<TagInsertControl | null>(null);
  const lastTextTarget = useRef<TextTarget>('body');

  /**
   * Chèn một mã vào chỗ con trỏ của ô vừa gõ gần nhất; ô tự báo chữ mới qua onChange.
   * @param tag  mã cần chèn, vd 'ho_ten'
   */
  const insertTag = (tag: EmailTag) => {
    const controlRef = lastTextTarget.current === 'subject' ? subjectControlRef : bodyControlRef;
    controlRef.current?.insertTag(tag);
  };

  return (
    <>
      <div className={styles.tagPicker}>
        <span className={styles.tagPickerLabel}>
          Mã chèn vào thư <small>Bấm để chèn vào chỗ đang gõ</small>
        </span>
        <div className={styles.chips}>
          {EMAIL_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.chip}
              title={EMAIL_TAG_LABEL[tag]}
              aria-label={`Chèn mã ${tag}: ${EMAIL_TAG_LABEL[tag]}`}
              // Giữ con trỏ ở ô đang gõ khi bấm
              onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
              onClick={() => insertTag(tag)}
            >
              {`{${tag}}`}
            </button>
          ))}
        </div>
      </div>

      {/* Không dùng Field (thẻ <label>): ô không phải <input> nên nhãn không gắn được vào ô */}
      <div className={fieldStyles.field}>
        <span>
          Tiêu đề thư
          <RequiredMark />
        </span>
        <TagTextInput
          value={subject}
          onChange={(nextSubject) => onChange({ subject: nextSubject })}
          label="Tiêu đề thư"
          invalid={!!subjectError}
          tags={EMAIL_TAGS}
          controlRef={subjectControlRef}
          onFocus={() => (lastTextTarget.current = 'subject')}
        />
        {subjectError && (
          <span className={fieldStyles.error} role="alert">
            {subjectError}
          </span>
        )}
      </div>

      {/* Không dùng Field (thẻ <label>): bấm vào nhãn sẽ bấm luôn nút đầu tiên của thanh định dạng */}
      <div className={`${fieldStyles.field} ${styles.bodyField}`} onFocus={() => (lastTextTarget.current = 'body')}>
        <span>
          Nội dung thư
          <RequiredMark />
        </span>
        <RichTextEditor
          value={body}
          onChange={(nextBody) => onChange({ body: nextBody })}
          label="Nội dung thư"
          placeholder="Nội dung thư. Gõ # để làm tiêu đề, - để gạch đầu dòng, Ctrl+B in đậm."
          invalid={!!bodyError}
          tags={EMAIL_TAGS}
          controlRef={bodyControlRef}
        />
        {bodyError && (
          <span className={fieldStyles.error} role="alert">
            {bodyError}
          </span>
        )}
      </div>
    </>
  );
}
