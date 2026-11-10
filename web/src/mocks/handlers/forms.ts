/* API giả: NHIỀU lá đơn (đơn mình đã nộp, đơn phụ trách, Quản lí đơn, CCCD người nộp). Một lá đơn ở form.ts. */
import { delay, http, HttpResponse } from 'msw';
import {
  ENDPOINTS,
  FORMS_MESSAGES,
  can,
  type FormCccdsResponse,
  type HandledFormsResponse,
  type ManagedFormsResponse,
  type MyFormsResponse,
} from '@ulaw/shared';
import { getAllForms, getApplicantCccds, getFormsHandledBy, getFormsOf, readSession } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

export const formsHandlers = [
  // Các đơn mình đã nộp
  http.get(api(ENDPOINTS.forms.mine), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORMS_MESSAGES[401]);
    return HttpResponse.json<MyFormsResponse>({ forms: getFormsOf(session.user.id) });
  }),

  // Các đơn mình tiếp nhận hoặc đang xử lí: chỉ vai trò được xử lí đơn (quyền decide)
  http.get(api(ENDPOINTS.forms.handled), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORMS_MESSAGES[401]);
    if (!can(session.role, 'decide')) return apiError(403, FORMS_MESSAGES.handledForbidden);
    return HttpResponse.json<HandledFormsResponse>({ forms: getFormsHandledBy(session.user.id) });
  }),

  // Mọi đơn của mọi người nộp (bảng Quản lí đơn): cần quyền viewAll
  http.get(api(ENDPOINTS.forms.list), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORMS_MESSAGES[401]);
    if (!can(session.role, 'viewAll')) return apiError(403, FORMS_MESSAGES.listForbidden);
    return HttpResponse.json<ManagedFormsResponse>({ forms: getAllForms() });
  }),

  // CCCD đầy đủ của mọi người nộp (nút "Hiện CCCD"): cần quyền viewApplicant
  http.get(api(ENDPOINTS.forms.cccds), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORMS_MESSAGES[401]);
    if (!can(session.role, 'viewApplicant')) return apiError(403, FORMS_MESSAGES.cccdsForbidden);
    return HttpResponse.json<FormCccdsResponse>({ cccds: getApplicantCccds() });
  }),
];
