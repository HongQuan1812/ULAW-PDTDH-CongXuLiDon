/* API giả: lá đơn (bước này mới có danh sách đơn của mình). */
import { delay, http, HttpResponse } from 'msw';
import { ENDPOINTS, FORM_MESSAGES, type MyFormsResponse } from '@ulaw/shared';
import { getFormsOf, readSession } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

export const formHandlers = [
  // Các đơn mình đã nộp
  http.get(api(ENDPOINTS.forms.mine), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_MESSAGES[401]);
    return HttpResponse.json<MyFormsResponse>({ forms: getFormsOf(session.user.id) });
  }),
];
