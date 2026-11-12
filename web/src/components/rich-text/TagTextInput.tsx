/* Ô nhập một dòng chữ thường (trông như <input>) có mã {…}: tô màu mã như RichTextEditor, nhận lệnh chèn mã từ bên ngoài.
   Ô <input> thường không tô màu được một phần chữ, nên ô này dựng bằng Tiptap: một đoạn duy nhất, không định dạng, không xuống dòng. */
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { EditorContent, Node, useEditor } from '@tiptap/react';
import { Placeholder } from '@tiptap/extensions';
import type { EditorView } from '@tiptap/pm/view';
import { createTagHighlightExtension, type TagInsertControl } from './tagHighlight';
import styles from './RichText.module.css';

interface TagTextInputProps {
  /** Chữ hiện tại */
  value: string;
  /** Gọi mỗi lần chữ đổi, kèm chữ mới */
  onChange: (nextValue: string) => void;
  /** Tên ô cho trình đọc màn hình, vd "Tiêu đề thư" */
  label: string;
  /** Chữ mờ khi ô trống */
  placeholder?: string;
  /** Ô lỗi: viền đỏ */
  invalid?: boolean;
  /** Các mã dùng được, vd ['ho_ten', 'ma_don']: mã trong danh sách tô xanh, mã lạ tô đỏ */
  tags?: readonly string[];
  /** Nhận lệnh điều khiển ô từ bên ngoài, vd nút chèn mã nằm ngoài ô */
  controlRef?: RefObject<TagInsertControl | null>;
  /** Gọi khi ô được bấm vào / gõ vào */
  onFocus?: () => void;
}

/** Văn bản một dòng: đúng một đoạn, trong đoạn chỉ có chữ thường. */
const SINGLE_LINE_NODES = [
  Node.create({ name: 'doc', topNode: true, content: 'paragraph' }),
  Node.create({
    name: 'paragraph',
    group: 'block',
    content: 'text*',
    parseHTML: () => [{ tag: 'p' }],
    renderHTML: () => ['p', 0],
  }),
  Node.create({ name: 'text', group: 'inline' }),
];

/**
 * Đổi chữ thành nội dung Tiptap một dòng.
 * @param text  chữ
 * @returns     JSON một đoạn; chữ trống thì đoạn rỗng
 */
function toSingleLineDoc(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] };
}

/**
 * Ô nhập một dòng có mã.
 * @param props  xem TagTextInputProps
 * @returns      ô nhập
 */
export function TagTextInput({ value, onChange, label, placeholder, invalid = false, tags, controlRef, onFocus }: TagTextInputProps) {
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const extensions = useMemo(
    () => [...SINGLE_LINE_NODES, Placeholder.configure({ placeholder: placeholder ?? '' }), createTagHighlightExtension(tagsRef)],
    [placeholder],
  );

  const editorProps = useMemo(
    () => ({
      attributes: { class: styles.lineInputContent ?? '', role: 'textbox', 'aria-label': label, 'aria-invalid': String(invalid) },
      // Enter không xuống dòng
      handleKeyDown: (_view: EditorView, keyEvent: KeyboardEvent) => keyEvent.key === 'Enter',
      // Dán chữ nhiều dòng: nối thành một dòng (dấu cách thay chỗ xuống dòng)
      handlePaste: (view: EditorView, pasteEvent: ClipboardEvent) => {
        const pastedText = pasteEvent.clipboardData?.getData('text/plain');
        if (pastedText === undefined) return false;
        view.dispatch(view.state.tr.insertText(pastedText.replace(/\s*[\r\n]+\s*/g, ' ')));
        return true;
      },
    }),
    [label, invalid],
  );

  const editor = useEditor({
    extensions,
    content: toSingleLineDoc(value),
    editorProps,
    onUpdate: ({ editor: updatedEditor }) => onChange(updatedEditor.getText()),
    onFocus: () => onFocus?.(),
  });

  // Đưa lệnh chèn mã ra ngoài khi ô đã tạo xong
  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = editor && { insertTag: (tag) => editor.chain().focus().insertContent({ type: 'text', text: `{${tag}}` }).run() };
  }, [editor, controlRef]);

  // Chữ đổi từ bên ngoài (vd Bỏ thay đổi) thì cập nhật ô, không báo ngược lên
  useEffect(() => {
    if (editor && editor.getText() !== value) editor.commands.setContent(toSingleLineDoc(value), { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className={`${styles.lineInput} ${invalid ? styles.invalid : ''}`}>
      <EditorContent editor={editor} />
    </div>
  );
}
