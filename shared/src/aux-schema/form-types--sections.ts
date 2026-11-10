/* Các phần (khung) của nội dung loại đơn: mỗi phần gồm tiêu đề, hướng dẫn và các câu hỏi.
   Loại đơn đầy đủ (FormTypeSchema trong api-contract/form-types.ts) gồm thông tin chung + các phần này.
   Cấu trúc lưu dạng JSON (PostgreSQL: JSONB); mỗi lá đơn lưu kèm bản chụp cấu trúc lúc nộp. */
import { z } from 'zod';
import { QuestionSchema } from './form-types--question-types';

/** Một phần (một khung) của nội dung đơn. */
export const FormSectionSchema = z.object({
  id: z.string().min(1),
  /** Tiêu đề phần, vd "Đăng ký miễn môn" */
  title: z.string(),
  /** Hướng dẫn ngắn dưới tiêu đề */
  hint: z.string().optional(),
  /** Nội dung chính: hiện trong xem nhanh (nút ›) ở các bảng đơn */
  main: z.boolean().default(false),
  questions: z.array(QuestionSchema),
});
export type FormSection = z.infer<typeof FormSectionSchema>;
