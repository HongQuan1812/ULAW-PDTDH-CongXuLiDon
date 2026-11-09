/* Tiện ích chung cho các handler của API giả. */
import { HttpResponse } from 'msw';
import type { ApiErrorBody } from '@ulaw/shared';

/** Thời gian mỗi handler chờ trước khi trả kết quả, để thấy giao diện lúc đang tải. */
export const MOCK_DELAY_MS = 1000;

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
