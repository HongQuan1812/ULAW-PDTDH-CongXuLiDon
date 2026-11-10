/* API giả: loại đơn (bước này mới có danh sách loại đơn đang mở). */
import { delay, http, HttpResponse } from 'msw';
import { ENDPOINTS, FORM_TYPE_MESSAGES, type OpenFormTypesResponse } from '@ulaw/shared';
import { getOpenFormTypes, readSession } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

export const formTypeHandlers = [
  // Các loại đơn đang nhận đơn
  http.get(api(ENDPOINTS.formTypes.open), async () => {
    await delay(MOCK_DELAY_MS);
    if (!readSession()) return apiError(401, FORM_TYPE_MESSAGES[401]);
    return HttpResponse.json<OpenFormTypesResponse>({ formTypes: getOpenFormTypes() });
  }),
];
