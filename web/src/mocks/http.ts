/* Tiện ích chung cho các handler của API giả. */
import { HttpResponse } from 'msw';
import { parseListQuery, parseUserIdsParam, type ApiErrorBody, type ListQuery, type TableField } from '@ulaw/shared';

/** Thời gian mỗi handler chờ trước khi trả kết quả, để thấy giao diện lúc đang tải. */
export const MOCK_DELAY_MS = 1000;

/**
 * Đọc tỉ lệ API giả trả lỗi 500 ngẫu nhiên từ VITE_MOCK_BACKEND_FAILURE_RATE.
 * @returns  số từ 0 đến 1; không đặt hoặc sai định dạng thì 0 (không bao giờ lỗi)
 */
function readFailureRate(): number {
  const rate = Number(import.meta.env.VITE_MOCK_BACKEND_FAILURE_RATE ?? 0);
  return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0;
}

/** Tỉ lệ mỗi lần gọi API giả bị trả lỗi 500, để thử giao diện khi máy chủ lỗi. */
export const MOCK_BACKEND_FAILURE_RATE = readFailureRate();

/**
 * Ghép đường dẫn trong ENDPOINTS thành đường dẫn đầy đủ mà MSW chặn.
 * @param path  đường dẫn sau /api, vd '/auth/me'
 * @returns     vd '/api/auth/me'
 */
export function api(path: string): string {
  return `/api${path}`;
}

/**
 * Đọc các tham số trên đường dẫn của request.
 * @param request  request MSW chặn được
 * @returns        tham số theo tên, vd { page: '2', search: 'nguyen' }
 */
function searchParamsOf(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}

/**
 * Đọc lần hỏi một trang của bảng danh sách (trang, số dòng, tìm, sắp xếp, lọc) từ đường dẫn.
 * @param request  request MSW chặn được
 * @param fields   các cột của bảng, để kiểm tra cột được sắp xếp, lọc
 * @returns        lần hỏi trang; sai thì null (handler trả 422 COMMON_MESSAGES.listQuery)
 */
export function readListQuery<Row>(request: Request, fields: readonly TableField<Row>[]): ListQuery | null {
  return parseListQuery(searchParamsOf(request), fields);
}

/**
 * Đọc danh sách người cần hiện CCCD (tham số userIds) từ đường dẫn.
 * @param request  request MSW chặn được
 * @returns        các id; sai thì null (handler trả 422 COMMON_MESSAGES.userIds)
 */
export function readUserIds(request: Request): string[] | null {
  return parseUserIdsParam(searchParamsOf(request).userIds);
}

/**
 * Chỉ giữ CCCD của những người được hỏi.
 * @param cccdsByUserId  CCCD đầy đủ theo id người dùng
 * @param userIds        id những người được hỏi
 * @returns              CCCD theo id, chỉ của những người được hỏi (người chưa có CCCD thì không có mặt)
 */
export function pickCccds(cccdsByUserId: Record<string, string>, userIds: readonly string[]): Record<string, string> {
  return Object.fromEntries(userIds.flatMap((userId) => (cccdsByUserId[userId] ? [[userId, cccdsByUserId[userId]]] : [])));
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
