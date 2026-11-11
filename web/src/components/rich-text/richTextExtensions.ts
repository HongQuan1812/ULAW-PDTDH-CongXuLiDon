/* Bộ định dạng cho trình soạn văn bản: gõ "- " hoặc "* " ra gạch đầu dòng, "1. " ra danh sách số, "# " ra tiêu đề,
   Ctrl+B in đậm, Ctrl+I in nghiêng, Ctrl+U gạch chân (như Notion). Chỉ mở các định dạng cần dùng, để dữ liệu lưu ra gọn và đoán được. */
import type { JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

/** Nội dung văn bản có định dạng, lưu dạng JSON của Tiptap (ProseMirror). */
export type RichTextDoc = JSONContent;

/** Các cấp tiêu đề cho phép: "# ", "## ", "### ". */
export const HEADING_LEVELS = [1, 2, 3] as const;

/**
 * Các tiện ích của trình soạn, dùng chung cho ô soạn và ô chỉ xem để hai bên hiện giống nhau.
 * @returns  danh sách tiện ích (StarterKit đã tắt các định dạng không dùng)
 */
export function createRichTextExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      // Chưa dùng: link, code, gạch ngang, trích dẫn, đường kẻ
      link: false,
      code: false,
      codeBlock: false,
      strike: false,
      blockquote: false,
      horizontalRule: false,
    }),
  ];
}
