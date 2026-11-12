/* Thư của một lúc gửi trên trang Cấu hình email (như emRenderEditor, emRenderPreview của artifact/js/email-page.js):
   công tắc "Gửi email", tiêu đề, nút chèn mã, nội dung (soạn có định dạng như trình soạn văn bản); xem trước bằng dữ liệu mẫu; gửi thư thử.
   Lúc gửi đang tắt: phần soạn và xem trước mờ đi và không bấm được, công tắc vẫn bấm được. */
import { useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { Editor } from '@tiptap/react';
import {
  EMAIL_SAMPLE_RECIPIENT,
  EMAIL_SAMPLE_VALUES,
  EMAIL_TAGS,
  EMAIL_TAG_LABEL,
  SendTestEmailRequestSchema,
  splitEmailTemplate,
  type EmailEventSetting,
  type EmailSender,
  type EmailTag,
  type EmailTagValues,
  type RichTextNode,
} from '@ulaw/shared';
import { useSendTestEmail } from '../../api/email';
import { Button } from '../../components/Button';
import { Field, RequiredMark } from '../../components/Field';
import { RichTextEditor } from '../../components/rich-text/RichTextEditor';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../features/auth/useAuth';
import type { FieldErrors } from './EmailSettingsPage';
import fieldStyles from '../../components/Field.module.css';
import richTextStyles from '../../components/rich-text/RichText.module.css';
import styles from './EmailSettingsPage.module.css';

/** Ô đang gõ khi bấm nút chèn mã. */
type TextTarget = 'subject' | 'body';

interface EmailEventEditorProps {
  /** thư của lúc gửi đang chọn (bản nháp) */
  event: EmailEventSetting;
  /** vị trí lúc gửi trong cấu hình, để tìm câu báo lỗi, vd 'events.1.subject' */
  eventIndex: number;
  /** người gửi (bản nháp), cho khung xem trước và thư thử */
  sender: EmailSender;
  /** câu báo lỗi theo ô của cả cấu hình */
  fieldErrors: FieldErrors;
  /** sửa thư của lúc gửi này */
  onChange: (changes: Partial<EmailEventSetting>) => void;
}

/**
 * Phần soạn, xem trước và gửi thử thư của một lúc gửi.
 * @returns  hai mục: Soạn thư, Xem trước
 */
export function EmailEventEditor({ event, eventIndex, sender, fieldErrors, onChange }: EmailEventEditorProps) {
  const toast = useToast();
  const { user } = useAuth();
  const sendTestEmail = useSendTestEmail();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyEditorRef = useRef<Editor | null>(null);
  // Ô gõ gần nhất: nút chèn mã chèn vào ô này (mặc định Nội dung thư)
  const lastTextTarget = useRef<TextTarget>('body');
  const [testRecipient, setTestRecipient] = useState(user.email);
  const [testError, setTestError] = useState<string | null>(null);

  const subjectError = fieldErrors[`events.${eventIndex}.subject`];
  const bodyError = fieldErrors[`events.${eventIndex}.body`];
  const sampleValues: EmailTagValues = { ...EMAIL_SAMPLE_VALUES, chu_ki: sender.signature };
  // Lúc gửi đang tắt: làm mờ phần soạn, xem trước (kèm inert để không bấm, không gõ được)
  const dimmedClass = event.enabled ? '' : styles.dimmed;

  /**
   * Chèn một mã vào chỗ con trỏ của ô gõ gần nhất (thay phần đang bôi đen), rồi đặt con trỏ ngay sau mã.
   * @param tag  mã cần chèn, vd 'ho_ten'
   */
  const insertTag = (tag: EmailTag) => {
    const tagText = `{${tag}}`;

    // Nội dung thư: trình soạn tự chèn vào chỗ con trỏ và báo nội dung mới qua onChange
    if (lastTextTarget.current === 'body') {
      bodyEditorRef.current?.chain().focus().insertContent({ type: 'text', text: tagText }).run();
      return;
    }

    // Tiêu đề: ghép mã vào giữa chữ đang có
    const element = subjectRef.current;
    if (!element) return;
    const selectionStart = element.selectionStart ?? element.value.length;
    const selectionEnd = element.selectionEnd ?? selectionStart;
    const nextText = element.value.slice(0, selectionStart) + tagText + element.value.slice(selectionEnd);

    // Vẽ lại ngay để đặt được con trỏ sau mã vừa chèn
    flushSync(() => onChange({ subject: nextText }));
    element.focus();
    element.setSelectionRange(selectionStart + tagText.length, selectionStart + tagText.length);
  };

  /** Gửi thư thử theo bản đang soạn; địa chỉ sai hoặc máy chủ báo lỗi thì báo ngay dưới ô địa chỉ. */
  const sendTest = async () => {
    setTestError(null);
    const parsed = SendTestEmailRequestSchema.safeParse({ to: testRecipient, sender, subject: event.subject, body: event.body });
    if (!parsed.success) {
      setTestError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    try {
      const response = await sendTestEmail.mutateAsync(parsed.data);
      toast(response.message, 'success');
    } catch (error) {
      setTestError(error instanceof Error ? error.message : null);
    }
  };

  return (
    <>
      <div className={styles.section}>
        <div className={styles.captionRow}>
          <p className={styles.caption}>Soạn thư</p>
          <div className={styles.sendToggle}>
            <span className={styles.sendNote}>{event.enabled ? 'Gửi tới email người nộp đơn' : 'Đang tắt, không gửi email'}</span>
            <label className={styles.switch}>
              <span>Gửi email</span>
              <input type="checkbox" checked={event.enabled} onChange={(changeEvent) => onChange({ enabled: changeEvent.target.checked })} />
            </label>
          </div>
        </div>

        <div className={`${styles.fields} ${dimmedClass}`} inert={!event.enabled}>
          <Field label="Tiêu đề thư" required error={subjectError}>
            <input
              ref={subjectRef}
              autoComplete="off"
              value={event.subject}
              aria-invalid={!!subjectError}
              onFocus={() => (lastTextTarget.current = 'subject')}
              onChange={(changeEvent) => onChange({ subject: changeEvent.target.value })}
            />
          </Field>

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

          {/* Không dùng Field (thẻ <label>): bấm vào nhãn sẽ bấm luôn nút đầu tiên của thanh định dạng */}
          <div className={`${fieldStyles.field} ${styles.bodyField}`} onFocus={() => (lastTextTarget.current = 'body')}>
            <span>
              Nội dung thư
              <RequiredMark />
            </span>
            <RichTextEditor
              value={event.body}
              onChange={(body) => onChange({ body })}
              label="Nội dung thư"
              placeholder="Nội dung thư. Gõ # để làm tiêu đề, - để gạch đầu dòng, Ctrl+B in đậm."
              invalid={!!bodyError}
              editorRef={bodyEditorRef}
            />
            {bodyError && (
              <span className={fieldStyles.error} role="alert">
                {bodyError}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`${styles.section} ${dimmedClass}`} inert={!event.enabled}>
        <p className={styles.caption}>
          Xem trước <span>· dữ liệu mẫu, phần đã thay được tô nền</span>
        </p>
        <div className={styles.mail}>
          <dl className={styles.mailHead}>
            <dt>Từ</dt>
            <dd>
              {sender.name} &lt;{sender.address}&gt;
            </dd>
            <dt>Tới</dt>
            <dd>
              {EMAIL_SAMPLE_VALUES.ho_ten} &lt;{EMAIL_SAMPLE_RECIPIENT}&gt; <span className={styles.toNote}>· email trên trang Thông tin cá nhân</span>
            </dd>
            <dt>Tiêu đề</dt>
            <dd className={styles.mailSubject}>
              <FilledText template={event.subject} values={sampleValues} highlight={false} />
            </dd>
          </dl>
          <div className={`${styles.mailBody} ${richTextStyles.content} ${richTextStyles.view}`}>
            {(event.body.content ?? []).map((node, index) => (
              <FilledRichNode key={index} node={node} values={sampleValues} />
            ))}
          </div>
        </div>

        <div className={styles.testRow}>
          <Field label="Gửi thử tới" error={testError ?? undefined}>
            <input
              type="email"
              autoComplete="off"
              value={testRecipient}
              aria-invalid={!!testError}
              onChange={(changeEvent) => {
                setTestRecipient(changeEvent.target.value);
                setTestError(null);
              }}
            />
          </Field>
          <Button onClick={sendTest} disabled={sendTestEmail.isPending}>
            {sendTestEmail.isPending ? 'Đang gửi…' : 'Gửi email thử'}
          </Button>
        </div>
        <p className={styles.hint}>Email thử có chữ [Thử] ở đầu tiêu đề và dùng dữ liệu mẫu ở trên.</p>
      </div>
    </>
  );
}

/**
 * Tiêu đề / nội dung thư sau khi thay mã bằng dữ liệu mẫu.
 * @param template   chữ có mã
 * @param values     giá trị của từng mã
 * @param highlight  true: tô nền phần đã thay; mã lạ luôn tô đỏ
 * @returns          các đoạn chữ
 */
function FilledText({ template, values, highlight }: { template: string; values: EmailTagValues; highlight: boolean }) {
  return splitEmailTemplate(template, values).map((part, index) => {
    if (part.kind === 'unknown') {
      return (
        <mark key={index} className={styles.unknownTag} title="Mã này không có, thư sẽ giữ nguyên chữ này">
          {part.text}
        </mark>
      );
    }
    if (part.kind === 'filled' && highlight) {
      return (
        <mark key={index} className={styles.filledTag}>
          {part.text}
        </mark>
      );
    }
    return <span key={index}>{part.text}</span>;
  });
}

/**
 * Một nút của nội dung thư (đoạn, tiêu đề, danh sách, chữ…) sau khi thay mã bằng dữ liệu mẫu, giữ nguyên định dạng.
 * @param node    nút của văn bản có định dạng
 * @param values  giá trị của từng mã
 * @returns       thẻ HTML tương ứng (p, h1–h3, ul, ol, li, br; chữ bọc strong / em / u theo định dạng)
 */
function FilledRichNode({ node, values }: { node: RichTextNode; values: EmailTagValues }): ReactNode {
  const children = (node.content ?? []).map((child, index) => <FilledRichNode key={index} node={child} values={values} />);

  // Chữ: thay mã, rồi bọc các định dạng từ trong ra ngoài
  if (node.type === 'text') {
    return (node.marks ?? []).reduce<ReactNode>(
      (inner, mark) => (mark.type === 'bold' ? <strong>{inner}</strong> : mark.type === 'italic' ? <em>{inner}</em> : <u>{inner}</u>),
      <FilledText template={node.text ?? ''} values={values} highlight />,
    );
  }

  // Các khối
  switch (node.type) {
    case 'paragraph':
      // đoạn trống vẫn giữ một dòng, như trong ô soạn
      return <p>{children.length > 0 ? children : <br />}</p>;
    case 'heading':
      return node.attrs?.level === 1 ? <h1>{children}</h1> : node.attrs?.level === 2 ? <h2>{children}</h2> : <h3>{children}</h3>;
    case 'bulletList':
      return <ul>{children}</ul>;
    case 'orderedList':
      return <ol>{children}</ol>;
    case 'listItem':
      return <li>{children}</li>;
    case 'hardBreak':
      return <br />;
    default:
      return <>{children}</>;
  }
}
