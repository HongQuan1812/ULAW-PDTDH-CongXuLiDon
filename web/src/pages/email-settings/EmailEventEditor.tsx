/* Thư của một lúc gửi trên trang Cấu hình email:
   công tắc "Gửi email", tiêu đề, nút chèn mã, nội dung (soạn có định dạng như trình soạn văn bản); xem trước bằng dữ liệu mẫu; gửi thư thử.
   Lúc gửi đang tắt: phần soạn và xem trước mờ đi và không bấm được, công tắc vẫn bấm được. */
import { useState, type ReactNode } from 'react';
import {
  EMAIL_SAMPLE_RECIPIENT,
  EMAIL_SAMPLE_VALUES,
  SendTestEmailRequestSchema,
  splitEmailTemplate,
  type EmailEventSetting,
  type EmailSender,
  type EmailTagValues,
  type RichTextNode,
} from '@ulaw/shared';
import { useSendTestEmail } from '../../api/email';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../features/auth/useAuth';
import { EmailComposer } from './EmailComposer';
import type { FieldErrors } from './EmailSettingsPage';
import richTextStyles from '../../components/rich-text/RichText.module.css';
import styles from './EmailSettingsPage.module.css';

interface EmailEventEditorProps {
  /** thư của lúc gửi đang chọn (bản nháp) */
  event: EmailEventSetting;
  /** vị trí lúc gửi trong cấu hình, để tìm câu báo lỗi, vd 'events.1.subject' */
  eventIndex: number;
  /** người gửi (bản nháp), cho khung xem trước và thư thử */
  sender: EmailSender;
  /** địa chỉ gửi (từ cấu hình SMTP của máy chủ), cho khung xem trước */
  senderAddress: string;
  /** câu báo lỗi theo ô của cả cấu hình */
  fieldErrors: FieldErrors;
  /** sửa thư của lúc gửi này */
  onChange: (changes: Partial<EmailEventSetting>) => void;
}

/**
 * Phần soạn, xem trước và gửi thử thư của một lúc gửi.
 * @returns  hai mục: Soạn thư, Xem trước
 */
export function EmailEventEditor({ event, eventIndex, sender, senderAddress, fieldErrors, onChange }: EmailEventEditorProps) {
  const toast = useToast();
  const { user } = useAuth();
  const sendTestEmail = useSendTestEmail();
  const [testRecipient, setTestRecipient] = useState(user.email);
  const [testError, setTestError] = useState<string | null>(null);

  const subjectError = fieldErrors[`events.${eventIndex}.subject`];
  const bodyError = fieldErrors[`events.${eventIndex}.body`];
  const sampleValues: EmailTagValues = { ...EMAIL_SAMPLE_VALUES, chu_ki: sender.signature };
  // Lúc gửi đang tắt: làm mờ phần soạn, xem trước (kèm inert để không bấm, không gõ được)
  const dimmedClass = event.enabled ? '' : styles.dimmed;

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
          <EmailComposer subject={event.subject} body={event.body} subjectError={subjectError} bodyError={bodyError} onChange={onChange} />
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
              {sender.name} &lt;{senderAddress}&gt;
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
