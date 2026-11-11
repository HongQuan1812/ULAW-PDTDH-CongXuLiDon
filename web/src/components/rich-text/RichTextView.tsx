/* Hiện văn bản có định dạng ở chế độ chỉ xem (chi tiết đơn, xem trước…), cùng bộ định dạng với RichTextEditor. */
import { EditorContent, useEditor } from '@tiptap/react';
import { createRichTextExtensions, type RichTextDoc } from './richTextExtensions';
import styles from './RichText.module.css';

/** Bộ tiện ích tạo một lần; tạo mới mỗi lần vẽ thì Tiptap cấu hình lại liên tục. */
const VIEW_EXTENSIONS = createRichTextExtensions();

/**
 * Văn bản có định dạng, chỉ xem.
 * @param value  nội dung (JSON của Tiptap)
 * @returns      nội dung đã định dạng; không có thì không hiện gì
 */
export function RichTextView({ value }: { value: RichTextDoc | null }) {
  const editor = useEditor({ extensions: VIEW_EXTENSIONS, content: value ?? undefined, editable: false }, [value]);
  if (!value) return null;
  return <EditorContent editor={editor} className={`${styles.content} ${styles.view}`} />;
}
