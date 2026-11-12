/* API giả: NHIỀU lá đơn (đơn mình đã nộp, đơn phụ trách, Quản lí đơn, CCCD người nộp). Một lá đơn ở form.ts.
   Các bảng đơn trả từng trang: tìm, lọc, sắp xếp, chia trang bằng applyListQuery() như backend thật. */
import { delay, http, HttpResponse } from 'msw';
import {
  COMMON_MESSAGES,
  ENDPOINTS,
  FORMS_MESSAGES,
  FORM_LIST_DEFAULT_SORTING,
  FORM_LIST_FIELDS,
  HANDLED_FORM_LIST_FIELDS,
  MANAGED_FORM_LIST_FIELDS,
  applyListQuery,
  can,
  type FormCccdsResponse,
  type FormStats,
  type HandledFormsResponse,
  type ManagedFormsResponse,
  type MyFormsResponse,
} from '@ulaw/shared';
import { getAllForms, getApplicantCccds, getFormStats, getFormsHandledBy, getFormsOf, readSession } from '../db';
import { MOCK_DELAY_MS, api, apiError, pickCccds, readListQuery, readUserIds } from '../http';

export const formsHandlers = [
  // Một trang trong các đơn mình đã nộp
  http.get(api(ENDPOINTS.forms.mine), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, FORMS_MESSAGES[401]);
    const listQuery = readListQuery(request, FORM_LIST_FIELDS);
    if (!listQuery) return apiError(422, COMMON_MESSAGES.listQuery);
    const { rows, ...pageMeta } = applyListQuery(getFormsOf(session.user.id), FORM_LIST_FIELDS, listQuery, FORM_LIST_DEFAULT_SORTING);
    return HttpResponse.json<MyFormsResponse>({ forms: rows, ...pageMeta });
  }),

  // Một trang trong các đơn mình tiếp nhận hoặc đang xử lí: chỉ vai trò được xử lí đơn (quyền decide)
  http.get(api(ENDPOINTS.forms.handled), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, FORMS_MESSAGES[401]);
    if (!can(session.role, 'decide')) return apiError(403, FORMS_MESSAGES.handledForbidden);
    const listQuery = readListQuery(request, HANDLED_FORM_LIST_FIELDS);
    if (!listQuery) return apiError(422, COMMON_MESSAGES.listQuery);
    const handledForms = getFormsHandledBy(session.user.id);
    const { rows, ...pageMeta } = applyListQuery(handledForms, HANDLED_FORM_LIST_FIELDS, listQuery, FORM_LIST_DEFAULT_SORTING);
    return HttpResponse.json<HandledFormsResponse>({ forms: rows, ...pageMeta });
  }),

  // Một trang trong mọi đơn của mọi người nộp (bảng Quản lí đơn): cần quyền viewAll.
  // Người có quyền viewApplicant tìm được theo số CCCD đầy đủ (ô CCCD vẫn che)
  http.get(api(ENDPOINTS.forms.list), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, FORMS_MESSAGES[401]);
    if (!can(session.role, 'viewAll')) return apiError(403, FORMS_MESSAGES.listForbidden);
    const listQuery = readListQuery(request, MANAGED_FORM_LIST_FIELDS);
    if (!listQuery) return apiError(422, COMMON_MESSAGES.listQuery);
    const cccdsByApplicant = can(session.role, 'viewApplicant') ? getApplicantCccds() : {};
    const fullCccdOf = (form: { applicant: { id: string } }) => [cccdsByApplicant[form.applicant.id] ?? ''];
    const { rows, ...pageMeta } = applyListQuery(getAllForms(), MANAGED_FORM_LIST_FIELDS, listQuery, FORM_LIST_DEFAULT_SORTING, fullCccdOf);
    return HttpResponse.json<ManagedFormsResponse>({ forms: rows, ...pageMeta });
  }),

  // Số đơn theo trạng thái, theo loại đơn (khung thống kê): cần quyền viewAll
  http.get(api(ENDPOINTS.forms.stats), async () => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, FORMS_MESSAGES[401]);
    if (!can(session.role, 'viewAll')) return apiError(403, FORMS_MESSAGES.statsForbidden);
    return HttpResponse.json<FormStats>(getFormStats());
  }),

  // CCCD đầy đủ của những người nộp đang có trên trang bảng (nút "Hiện CCCD"): cần quyền viewApplicant
  http.get(api(ENDPOINTS.forms.cccds), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, FORMS_MESSAGES[401]);
    if (!can(session.role, 'viewApplicant')) return apiError(403, FORMS_MESSAGES.cccdsForbidden);
    const userIds = readUserIds(request);
    if (!userIds) return apiError(422, COMMON_MESSAGES.userIds);
    return HttpResponse.json<FormCccdsResponse>({ cccds: pickCccds(getApplicantCccds(), userIds) });
  }),
];
