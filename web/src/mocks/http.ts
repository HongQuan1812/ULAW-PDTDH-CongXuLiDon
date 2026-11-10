/* Tiện ích chung cho các handler của API giả. */
import { HttpResponse } from 'msw';
import type { ApiErrorBody } from '@ulaw/shared';

/** Thời gian mỗi handler chờ trước khi trả kết quả, để thấy giao diện lúc đang tải. */
export const MOCK_DELAY_MS = 1000;

/**
 * Đọc tỉ lệ API giả trả lỗi 500 ngẫu nhiên từ VITE_MOCK_FAILURE_RATE.
 * @returns  số từ 0 đến 1; không đặt hoặc sai định dạng thì 0 (không bao giờ lỗi)
 */
function readFailureRate(): number {
  const rate = Number(import.meta.env.VITE_MOCK_FAILURE_RATE ?? 0);
  return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0;
}

/** Tỉ lệ mỗi lần gọi API giả bị trả lỗi 500, để thử giao diện khi máy chủ lỗi. */
export const MOCK_FAILURE_RATE = readFailureRate();

/**
 * Ghép đường dẫn trong ENDPOINTS thành đường dẫn đầy đủ mà MSW chặn.
 * @param path  đường dẫn sau /api, vd '/auth/me'
 * @returns     vd '/api/auth/me'
 */
export function api(path: string): string {
  return `/api${path}`;
}

/**
 * Trả lỗi giống backend thật.
 * @param status   mã HTTP, vd 401
 * @param message  câu báo lỗi hiện cho người dùng
 * @returns        response JSON { message }
 */
export function apiError(status: number, message: string): Response {
  return HttpResponse.json<ApiErrorBody>({ message }, { status });
}
