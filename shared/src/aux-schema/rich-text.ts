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
