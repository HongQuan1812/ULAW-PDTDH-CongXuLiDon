/* API giả: lá đơn (bước này mới có danh sách đơn của mình và đơn phụ trách). */
import { delay, http, HttpResponse } from 'msw';
import { ENDPOINTS, FORM_MESSAGES, can, type HandledFormsResponse, type MyFormsResponse } from '@ulaw/shared';
import { getFormsHandledBy, getFormsOf, readSession } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

export const formHandlers = [
  // Các đơn mình đã nộp
  http.get(api(ENDPOINTS.forms.mine), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_MESSAGES[401]);
    return HttpResponse.json<MyFormsResponse>({ forms: getFormsOf(session.user.id) });
  }),

  // Các đơn mình tiếp nhận hoặc đang xử lí: chỉ vai trò được xử lí đơn (quyền decide)
  http.get(api(ENDPOINTS.forms.handled), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_MESSAGES[401]);
    if (!can(session.role, 'decide')) return apiError(403, FORM_MESSAGES[403]);
    return HttpResponse.json<HandledFormsResponse>({ forms: getFormsHandledBy(session.user.id) });
  }),
];
