/* API giả: làm mọi API thỉnh thoảng lỗi 500 (tỉ lệ MOCK_FAILURE_RATE), để thấy giao diện báo lỗi.
   Đặt đầu danh sách handler: lần nào không lỗi thì không trả gì, MSW chuyển tiếp cho handler thật của API đó. */
import { delay, http } from 'msw';
import { COMMON_MESSAGES } from '@ulaw/shared';
import { MOCK_DELAY_MS, MOCK_FAILURE_RATE, api, apiError } from '../http';

export const randomFailureHandlers = [
  // Mọi đường dẫn /api/..., mọi phương thức
  http.all(api('/*'), async () => {
    if (Math.random() >= MOCK_FAILURE_RATE) return undefined;
    await delay(MOCK_DELAY_MS);
    return apiError(500, COMMON_MESSAGES[500]);
  }),
];
