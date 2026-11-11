/* Các loại câu hỏi của loại đơn (như QTYPES trong artifact/js/sections.js) và thuộc tính của từng loại.
   Trình soạn loại đơn tạo câu hỏi theo các schema này; trang nộp đơn vẽ ô trả lời theo đó.
   Thêm loại câu hỏi mới: thêm vào QUESTION_TYPES, QUESTION_TYPE_LABEL, một schema bên dưới và QuestionSchema,
   rồi thêm cách kiểm tra câu trả lời trong validators/forms--answers.ts và giao diện trong web/src/features/form-renderer/. */
import { z } from 'zod';
import { RichTextDocSchema } from './rich-text';

export const QUESTION_TYPES = ['text', 'para', 'number', 'date', 'radio', 'check', 'select', 'file', 'table', 'info'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Tên hiện trong trình soạn loại đơn. */
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  text: 'Trả lời ngắn',
  para: 'Đoạn văn',
  number: 'Số',
  date: 'Ngày',
  radio: 'Chọn một',
  check: 'Chọn nhiều',
  select: 'Danh sách thả xuống',
  file: 'Tải tệp',
  table: 'Bảng nhiều dòng',
  info: 'Khối thông báo (không cần trả lời)',
};

/** Mã dùng trong file Word, vd {mon}: chữ thường không dấu, số, gạch dưới. */
const TagSchema = z.string().regex(/^[a-z0-9_]+$/, 'Mã chỉ gồm chữ thường không dấu, số và dấu gạch dưới.');

/* ---------- Phần chung của mọi câu hỏi ---------- */

const questionBase = {
  /** Định danh câu hỏi, không đổi khi sửa loại đơn; câu trả lời lưu theo id này */
  id: z.string().min(1),
  /** Nội dung câu hỏi */
  label: z.string(),
  /** Mô tả, gợi ý cho người nộp đơn */
  help: z.string().optional(),
  /** Bắt buộc trả lời */
  required: z.boolean().default(false),
  /** Mã dùng trong file Word; bỏ trống thì tự lấy theo nội dung câu hỏi */
  tag: TagSchema.optional(),
};

/* ---------- Từng loại câu hỏi ---------- */

/** Trả lời ngắn, đoạn văn, số, ngày: chỉ có phần chung. */
const SimpleQuestionSchema = z.object({ ...questionBase, type: z.enum(['text', 'para', 'number', 'date']) });

/** Chọn một (radio), chọn nhiều (check), danh sách thả xuống (select). */
const ChoiceQuestionSchema = z.object({
  ...questionBase,
  type: z.enum(['radio', 'check', 'select']),
  /** Các lựa chọn, theo thứ tự hiện */
  options: z.array(z.string().min(1)).min(1, 'Cần ít nhất một lựa chọn.'),
});

/** Tải tệp. */
const FileQuestionSchema = z.object({
  ...questionBase,
  type: z.literal('file'),
  /** Đuôi tệp được nhận, chữ thường, vd ['pdf', 'jpg', 'png'] */
  accept: z.array(z.string().regex(/^[a-z0-9]+$/)).min(1),
  /** Dung lượng tối đa mỗi tệp (MB) */
  maxMB: z.number().positive(),
});

/** Một cột của bảng nhiều dòng. */
export const TableColumnSchema = z.object({
  /** Tên cột */
  label: z.string().min(1),
  /** Mô tả nhỏ dưới tên cột */
  sub: z.string().optional(),
  /** Kiểu ô: chữ hoặc số */
  type: z.enum(['text', 'number']),
  /** Chữ mờ gợi ý trong ô */
  placeholder: z.string().optional(),
  /** Cột số: tính tổng ở chân bảng */
  sum: z.boolean().optional(),
  /** Đơn vị khi ghi tổng, vd "tín chỉ" → "tổng 6 tín chỉ" */
  sumLabel: z.string().optional(),
  /** Mã của cột trong file Word; bỏ trống thì lấy theo tên cột */
  tag: TagSchema.optional(),
});
export type TableColumn = z.infer<typeof TableColumnSchema>;

/** Bảng nhiều dòng: mỗi dòng một bộ giá trị theo các cột. */
const TableQuestionSchema = z.object({
  ...questionBase,
  type: z.literal('table'),
  columns: z.array(TableColumnSchema).min(1, 'Bảng cần ít nhất một cột.'),
  /** Tên một dòng, vd "môn" → "+ Thêm môn", "3 môn" */
  rowName: z.string().min(1),
});

/** Màu nền của khối thông báo (bộ màu có sẵn, đã chỉnh cho cả nền sáng và nền tối). Không chọn = 'gray'. */
export const INFO_BLOCK_COLORS = ['gray', 'blue', 'green', 'yellow', 'red'] as const;
export type InfoBlockColor = (typeof INFO_BLOCK_COLORS)[number];

/** Tên màu hiện trong trình soạn loại đơn. */
export const INFO_BLOCK_COLOR_LABEL: Record<InfoBlockColor, string> = {
  gray: 'Xám',
  blue: 'Xanh dương',
  green: 'Xanh lá',
  yellow: 'Vàng',
  red: 'Đỏ',
};

/** Khối thông báo: chỉ có nội dung (văn bản có định dạng, tiêu đề nếu cần thì gõ "# " ngay trong nội dung), không cần trả lời. */
const InfoBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('info'),
  /** Nội dung thông báo */
  content: RichTextDocSchema,
  /** Màu nền; bỏ trống = xám */
  color: z.enum(INFO_BLOCK_COLORS).optional(),
});

/** Một câu hỏi của loại đơn; trường `type` quyết định có thêm thuộc tính nào. */
export const QuestionSchema = z.discriminatedUnion('type', [
  SimpleQuestionSchema,
  ChoiceQuestionSchema,
  FileQuestionSchema,
  TableQuestionSchema,
  InfoBlockSchema,
]);
export type Question = z.infer<typeof QuestionSchema>;

/** Câu hỏi theo loại, vd QuestionOf<'table'> có columns, rowName. */
export type QuestionOf<Type extends QuestionType> = Question & { type: Type };

/** Câu hỏi cần trả lời (mọi loại trừ khối thông báo). */
export type AnswerableQuestion = Exclude<Question, { type: 'info' }>;
