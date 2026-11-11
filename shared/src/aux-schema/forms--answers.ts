/* Câu trả lời của lá đơn: hình dạng dữ liệu (theo id câu hỏi) và vài hàm nhỏ đi kèm.
   Kiểm tra câu trả lời có đúng với câu hỏi không: xem validators/forms--answers.ts. */
import { z } from 'zod';
import type { AnswerableQuestion, Question } from './form-types--question-types';
import { EMPTY_RICH_TEXT_DOC, RichTextDocSchema } from './rich-text';

/* ---------- Câu trả lời ---------- */

/** Một ô của bảng nhiều dòng: chữ (cột chữ) hoặc số (cột số); null = ô số còn trống. */
export const TableCellSchema = z.union([z.string(), z.number(), z.null()]);
export type TableCell = z.infer<typeof TableCellSchema>;

/** Một tệp đã tải lên, là câu trả lời của câu hỏi tải tệp. */
export const FileRefSchema = z.object({
  /** Định danh tệp ở máy chủ */
  id: z.string().min(1),
  /** Tên tệp lúc tải lên, vd 'bang-diem.pdf' */
  name: z.string().min(1),
  /** Dung lượng (byte) */
  sizeBytes: z.number().int().nonnegative(),
});
export type FileRef = z.infer<typeof FileRefSchema>;

/**
 * Câu trả lời của một câu hỏi, theo loại câu hỏi:
 * đoạn văn → văn bản có định dạng (RichTextDoc; đơn cũ có thể còn là chuỗi)
 * trả lời ngắn / ngày ('YYYY-MM-DD') / chọn một / danh sách → chuỗi ("" = chưa trả lời)
 * số → số (null = chưa trả lời) · chọn nhiều → các lựa chọn · tải tệp → các tệp đã tải lên (FileRef)
 * bảng nhiều dòng → các dòng, mỗi dòng một ô theo thứ tự cột
 */
export const AnswerValueSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.array(z.string()),
  z.array(FileRefSchema),
  z.array(z.array(TableCellSchema)),
  RichTextDocSchema,
]);
export type AnswerValue = z.infer<typeof AnswerValueSchema>;

/** Mọi câu trả lời của lá đơn, theo id câu hỏi. */
export const FormAnswersSchema = z.record(z.string(), AnswerValueSchema);
export type FormAnswers = z.infer<typeof FormAnswersSchema>;

/**
 * Câu trả lời trống của một câu hỏi (đơn mới).
 * @param question  câu hỏi cần trả lời
 * @returns         "" · null (số) · [] (chọn nhiều, tải tệp, bảng) · văn bản trống (đoạn văn)
 */
export function emptyAnswer(question: AnswerableQuestion): AnswerValue {
  if (question.type === 'number') return null;
  if (question.type === 'check' || question.type === 'file' || question.type === 'table') return [];
  if (question.type === 'para') return EMPTY_RICH_TEXT_DOC;
  return '';
}

/**
 * Câu hỏi có cần trả lời không (khối thông báo thì không).
 * @param question  câu hỏi
 * @returns         true nếu là câu hỏi cần trả lời
 */
export function isAnswerable(question: Question): question is AnswerableQuestion {
  return question.type !== 'info';
}
