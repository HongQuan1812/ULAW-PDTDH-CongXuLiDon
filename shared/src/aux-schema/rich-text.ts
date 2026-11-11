/* Văn bản có định dạng (trình soạn kiểu Notion ở web/src/components/rich-text/), lưu dạng JSON của Tiptap / ProseMirror.
   Chỉ nhận các loại nút và định dạng trình soạn đang dùng, để máy chủ không lưu nội dung lạ (vd script) rồi trả về cho người khác xem.
   Thêm định dạng mới (link, code…): thêm vào hai danh sách bên dưới và bật ở web/src/components/rich-text/richTextExtensions.ts. */
import { z } from 'zod';

/** Các loại nút: gốc, đoạn, tiêu đề, danh sách (gạch đầu dòng, số), mục của danh sách, xuống dòng, chữ. */
export const RICH_TEXT_NODE_TYPES = ['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'hardBreak', 'text'] as const;

/** Các định dạng chữ: in đậm, in nghiêng, gạch chân. */
export const RICH_TEXT_MARK_TYPES = ['bold', 'italic', 'underline'] as const;

const RichTextMarkSchema = z.object({ type: z.enum(RICH_TEXT_MARK_TYPES) });

/** Một nút của văn bản. */
export interface RichTextNode {
  type: (typeof RICH_TEXT_NODE_TYPES)[number];
  /** Thuộc tính riêng của nút, vd { level: 2 } của tiêu đề, { start: 1 } của danh sách số */
  attrs?: Record<string, unknown>;
  /** Các nút con */
  content?: RichTextNode[];
  /** Chữ (chỉ nút "text") */
  text?: string;
  /** Định dạng của chữ */
  marks?: { type: (typeof RICH_TEXT_MARK_TYPES)[number] }[];
}

const RichTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.object({
    type: z.enum(RICH_TEXT_NODE_TYPES),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(RichTextNodeSchema).optional(),
    text: z.string().optional(),
    marks: z.array(RichTextMarkSchema).optional(),
  }),
);

/** Cả văn bản: nút gốc "doc". */
export const RichTextDocSchema = z.object({
  type: z.literal('doc'),
  content: z.array(RichTextNodeSchema).optional(),
});
export type RichTextDoc = z.infer<typeof RichTextDocSchema>;

/** Văn bản trống (một đoạn không có chữ), điểm bắt đầu của ô soạn. */
export const EMPTY_RICH_TEXT_DOC: RichTextDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

/**
 * Chữ của một nút và các nút con (không có dấu đầu dòng).
 * @param node  nút cần lấy chữ
 * @returns     chữ nối liền; xuống dòng cứng thành "\n"
 */
function inlineText(node: RichTextNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(inlineText).join('');
}

/**
 * Chữ của một khối (đoạn, tiêu đề, danh sách), mỗi dòng một phần tử.
 * @param node    khối cần lấy chữ
 * @param prefix  dấu đầu dòng của mục danh sách chứa khối này, vd "- " hoặc "2. "
 * @returns       các dòng chữ
 */
function blockLines(node: RichTextNode, prefix = ''): string[] {
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return (node.content ?? []).flatMap((item, index) => blockLines(item, node.type === 'bulletList' ? '- ' : `${index + 1}. `));
  }
  if (node.type === 'listItem') {
    const lines = (node.content ?? []).flatMap((child) => blockLines(child));
    return lines.map((line, index) => (index === 0 ? prefix + line : `${' '.repeat(prefix.length)}${line}`));
  }
  return [prefix + inlineText(node)];
}

/**
 * Văn bản có định dạng thành chữ thường, để điền vào file Word, tìm kiếm, kiểm tra "có trả lời chưa".
 * @param doc  văn bản có định dạng
 * @returns    chữ, mỗi đoạn / mục một dòng; danh sách có "- " hoặc "1. " đầu dòng; trống thì ""
 */
export function richTextToPlainText(doc: RichTextDoc): string {
  return (doc.content ?? []).flatMap((block) => blockLines(block)).join('\n').trim();
}

/**
 * Văn bản có định dạng có trống không (không có chữ nào ngoài khoảng trắng).
 * @param doc  văn bản có định dạng
 * @returns    true nếu trống
 */
export function isRichTextEmpty(doc: RichTextDoc): boolean {
  return richTextToPlainText(doc) === '';
}

/**
 * Chữ thường thành văn bản có định dạng (mỗi dòng một đoạn), để hiện câu trả lời cũ lưu dạng chuỗi.
 * @param text  chữ thường
 * @returns     văn bản có định dạng; chuỗi rỗng cho văn bản trống
 */
export function plainTextToRichText(text: string): RichTextDoc {
  if (!text) return EMPTY_RICH_TEXT_DOC;
  return {
    type: 'doc',
    content: text.split('\n').map((line): RichTextNode => (line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' })),
  };
}
