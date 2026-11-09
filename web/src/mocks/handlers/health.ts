/* API giả: kiểm tra máy chủ có trả lời không. */
import { delay, http, HttpResponse } from 'msw';
import { ENDPOINTS, type HealthResponse } from '@ulaw/shared';
import { MOCK_DELAY_MS, api } from '../http';

export const healthHandlers = [
  // Luôn trả lời "còn sống", đánh dấu là API giả
  http.get(api(ENDPOINTS.health.check), async () => {
    await delay(MOCK_DELAY_MS);
    return HttpResponse.json<HealthResponse>({ ok: true, mock: true });
  }),
];
