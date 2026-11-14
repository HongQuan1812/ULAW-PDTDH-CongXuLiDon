/* API giả: làm các API còn giả thỉnh thoảng lỗi 500 (tỉ lệ MOCK_BACKEND_FAILURE_RATE), để thấy giao diện báo lỗi.
   Đặt đầu danh sách handler: lần nào không lỗi thì không trả gì, MSW chuyển tiếp cho handler thật của API đó.
   Nhóm đã dùng API thật thì không bao giờ bị làm lỗi giả. */
import { delay, http, type RequestHandler } from 'msw';
import { COMMON_MESSAGES } from '@ulaw/shared';
import { MOCK_DELAY_MS, MOCK_BACKEND_FAILURE_RATE, api, apiError } from '../http';

/**
 * Tìm handler đầu tiên khớp request, theo đúng thứ tự MSW xét.
 * @param orderedHandlers  các handler theo thứ tự
 * @param request          request vừa chặn được
 * @returns                handler khớp đầu tiên; không có thì undefined
 */
export async function firstMatchingHandler(
  orderedHandlers: readonly RequestHandler[],
  request: Request,
): Promise<RequestHandler | undefined> {
  for (const handler of orderedHandlers) {
    if (await handler.test({ request })) return handler;
  }
  return undefined;
}

/**
 * Tạo handler làm lỗi ngẫu nhiên.
 * @param orderedHandlers  mọi handler theo thứ tự (cả handler chuyển sang API thật)
 * @param mockedHandlers   các handler của nhóm còn giả
 * @returns                handler đặt đầu danh sách
 */
export function createRandomFailureHandler(
  orderedHandlers: readonly RequestHandler[],
  mockedHandlers: ReadonlySet<RequestHandler>,
): RequestHandler {
  // Mọi đường dẫn /api/..., mọi phương thức
  return http.all(api('/*'), async ({ request }) => {
    if (Math.random() >= MOCK_BACKEND_FAILURE_RATE) return undefined;

    // Chỉ làm lỗi khi request rơi vào một nhóm còn giả
    const matchedHandler = await firstMatchingHandler(orderedHandlers, request);
    if (!matchedHandler || !mockedHandlers.has(matchedHandler)) return undefined;

    await delay(MOCK_DELAY_MS);
    return apiError(500, COMMON_MESSAGES[500]);
  });
}
