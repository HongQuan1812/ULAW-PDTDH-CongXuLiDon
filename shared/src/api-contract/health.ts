/* HỢP ĐỒNG nhóm API kiểm tra máy chủ: API có đang trả lời không. */
import { z } from 'zod';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const HEALTH_ENDPOINTS = {
  /** GET: máy chủ còn sống → HealthResponse */
  check: '/health',
} as const;

/* ---------- Dữ liệu nhận ---------- */

/** Kết quả kiểm tra. mock = true khi đang dùng API giả. */
export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  mock: z.boolean().optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
