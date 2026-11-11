/* API giả: loại đơn (danh sách cho trang Quản lí loại đơn, loại đơn đang mở, một loại đơn). */
import { delay, http, HttpResponse } from 'msw';
import { ENDPOINTS, FORM_TYPE_MESSAGES, can, type FormType, type FormTypesResponse, type OpenFormTypesResponse } from '@ulaw/shared';
import { getFormType, getFormTypeSummaries, getOpenFormTypes, readSession } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

export const formTypeHandlers = [
  // Mọi loại đơn, cho trang Quản lí loại đơn: cần quyền manageFormTypes
  http.get(api(ENDPOINTS.formTypes.list), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_TYPE_MESSAGES[401]);
    if (!can(session.role, 'manageFormTypes')) return apiError(403, FORM_TYPE_MESSAGES[403]);
    return HttpResponse.json<FormTypesResponse>({ formTypes: getFormTypeSummaries() });
  }),

  // Các loại đơn đang nhận đơn
  http.get(api(ENDPOINTS.formTypes.open), async () => {
    await delay(MOCK_DELAY_MS);
    if (!readSession()) return apiError(401, FORM_TYPE_MESSAGES[401]);
    return HttpResponse.json<OpenFormTypesResponse>({ formTypes: getOpenFormTypes() });
  }),

  // Một loại đơn, đủ cấu trúc: người không quản lí loại đơn chỉ lấy được loại đơn Đang mở
  http.get(api(ENDPOINTS.formTypes.detail), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_TYPE_MESSAGES[401]);
    const formType = getFormType(String(params.formTypeId), can(session.role, 'manageFormTypes'));
    if (!formType) return apiError(404, FORM_TYPE_MESSAGES[404]);
    return HttpResponse.json<FormType>(formType);
  }),
];
