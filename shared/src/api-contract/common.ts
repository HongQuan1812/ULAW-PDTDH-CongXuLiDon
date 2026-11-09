/* HỢP ĐỒNG dùng chung cho mọi nhóm API. */
import { z } from 'zod';

/** Body khi API trả lỗi (4xx, 5xx). */
export const ApiErrorBodySchema = z.object({ message: z.string() });
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
