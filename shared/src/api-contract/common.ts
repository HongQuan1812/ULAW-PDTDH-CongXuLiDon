/* HỢP ĐỒNG dùng chung cho mọi nhóm API. */
import { z } from 'zod';

/** Body khi API trả lỗi (4xx, 5xx). */
export const ApiErrorBodySchema = z.object({ message: z.string() });
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

/** Câu thông báo dùng chung cho mọi nhóm API, theo mã HTTP. */
export const COMMON_MESSAGES = {
  /** Lỗi bất ngờ ở máy chủ (mất kết nối CSDL, lỗi chưa lường trước…) */
  500: 'Máy chủ đang gặp sự cố, chưa làm được việc này. Hãy thử lại sau ít phút.',
} as const;
