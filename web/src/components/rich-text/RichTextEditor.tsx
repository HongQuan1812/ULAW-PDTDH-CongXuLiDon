/* Ô soạn văn bản có định dạng, gõ như Notion (xem richTextExtensions.ts). Có thanh nút nhỏ phía trên cho ai chưa quen phím tắt.
   Nội dung lưu dạng JSON của Tiptap; ô này chưa gắn vào chỗ nào, chờ gắn vào câu hỏi "Đoạn văn", mô tả phần… */
import { useEffect, useMemo, type RefObject } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { Placeholder } from '@tiptap/extensions';
import { createRichTextExtensions, HEADING_LEVELS, type RichTextDoc } from './richTextExtensions';
import styles from './RichText.module.css';

interface RichTextEditorProps {
  /** Nội dung hiện tại; null = trống */
  value: RichTextDoc | null;
  /** Gọi mỗi lần nội dung đổi, kèm nội dung mới */
  onChange: (nextValue: RichTextDoc) => void;
  /** Tên ô cho trình đọc màn hình, vd "Mô tả phần" */
  label: string;
  /** Chữ mờ khi ô trống */
  placeholder?: string;
  /** true = chỉ xem, không sửa được */
  disabled?: boolean;
  /** Ô lỗi: viền đỏ */
  invalid?: boolean;
  /** Giữ trình soạn để bên ngoài chèn chữ vào chỗ con trỏ (vd nút chèn mã của trang Cấu hình email) */
  editorRef?: RefObject<Editor | null>;
}

/** Một nút của thanh định dạng. */
interface ToolbarAction {
  label: string;
  /** Chữ hiện trên nút */
  text: string;
  /** Phím tắt, ghi trong gợi ý khi rê chuột */
  shortcut: string;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: 'In đậm', text: 'B', shortcut: 'Ctrl+B', isActive: (editor) => editor.isActive('bold'), run: (editor) => editor.chain().focus().toggleBold().run() },
  { label: 'In nghiêng', text: 'I', shortcut: 'Ctrl+I', isActive: (editor) => editor.isActive('italic'), run: (editor) => editor.chain().focus().toggleItalic().run() },
  { label: 'Gạch chân', text: 'U', shortcut: 'Ctrl+U', isActive: (editor) => editor.isActive('underline'), run: (editor) => editor.chain().focus().toggleUnderline().run() },
  ...HEADING_LEVELS.map((level) => ({
    label: `Tiêu đề ${level}`,
    text: `H${level}`,
    shortcut: `${'#'.repeat(level)} + dấu cách`,
    isActive: (editor: Editor) => editor.isActive('heading', { level }),
    run: (editor: Editor) => editor.chain().focus().toggleHeading({ level }).run(),
  })),
  { label: 'Gạch đầu dòng', text: '•', shortcut: '- hoặc * + dấu cách', isActive: (editor) => editor.isActive('bulletList'), run: (editor) => editor.chain().focus().toggleBulletList().run() },
  { label: 'Danh sách số', text: '1.', shortcut: '1. + dấu cách', isActive: (editor) => editor.isActive('orderedList'), run: (editor) => editor.chain().focus().toggleOrderedList().run() },
];

/**
 * Ô soạn văn bản có định dạng.
 * @param props  xem RichTextEditorProps
 * @returns      khung gồm thanh nút và vùng soạn
 */
export function RichTextEditor({ value, onChange, label, placeholder, disabled = false, invalid = false, editorRef }: RichTextEditorProps) {
  const extensions = useMemo(() => [...createRichTextExtensions(), Placeholder.configure({ placeholder: placeholder ?? '' })], [placeholder]);

  const editorProps = useMemo(
    () => ({ attributes: { class: styles.content ?? '', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label, 'aria-invalid': String(invalid) } }),
    [label, invalid],
  );

  const editor = useEditor({
    extensions,
    content: value ?? undefined,
    editable: !disabled,
    editorProps,
    // bộ định dạng đã giới hạn ở richTextExtensions.ts nên JSON luôn đúng RichTextDoc
    onUpdate: ({ editor: updatedEditor }) => onChange(updatedEditor.getJSON() as RichTextDoc),
  });

  // Đưa trình soạn ra ngoài khi đã tạo xong
  useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  // Nội dung hoặc chế độ sửa đổi từ bên ngoài (vd đặt lại form) thì cập nhật ô soạn, không báo ngược lên
  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable === disabled) editor.setEditable(!disabled, false);
    const isSameAsEditor = JSON.stringify(value ?? null) === JSON.stringify(editor.getJSON()) || (value === null && editor.isEmpty);
    if (!isSameAsEditor) editor.commands.setContent(value ?? '', { emitUpdate: false });
  }, [editor, value, disabled]);

  return (
    <div className={`${styles.box} ${invalid ? styles.invalid : ''} ${disabled ? styles.disabled : ''}`}>
      {editor && !disabled && (
        <div className={styles.toolbar} role="toolbar" aria-label={`Định dạng ${label}`}>
          {TOOLBAR_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`${styles.tool} ${action.text === 'B' ? styles.toolBold : ''} ${action.text === 'I' ? styles.toolItalic : ''} ${action.text === 'U' ? styles.toolUnderline : ''}`}
              title={`${action.label} (${action.shortcut})`}
              aria-label={action.label}
              aria-pressed={action.isActive(editor)}
              // giữ con trỏ trong ô soạn khi bấm nút
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => action.run(editor)}
            >
              {action.text}
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
