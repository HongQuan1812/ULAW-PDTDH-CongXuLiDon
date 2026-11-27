/* API giả: Ngày nghỉ (lễ, Tết, nghỉ bù mà hạn xử lí đơn không tính). Chỉ vai trò có quyền manageHolidays. */
import { delay, http, HttpResponse } from 'msw';
import { ENDPOINTS, HOLIDAY_MESSAGES, HolidayInputSchema, can, type Holiday, type HolidayInput, type HolidaysResponse } from '@ulaw/shared';
import { deleteHoliday, getHolidays, readSession, saveHoliday } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

/**
 * Kiểm tra người đang đăng nhập có quyền manageHolidays.
 * @returns  câu trả lỗi: chưa đăng nhập (401), không có quyền (403); được thì null
 */
async function accessError(): Promise<Response | null> {
  const session = await readSession();
  if (!session) return apiError(401, HOLIDAY_MESSAGES[401]);
  if (!can(session.role, 'manageHolidays')) return apiError(403, HOLIDAY_MESSAGES[403]);
  return null;
}

/**
 * Đọc ngày nghỉ trong body.
 * @param request  request MSW chặn được
 * @returns        body đã kiểm tra · errorResponse: 422 kèm câu báo của ô sai đầu tiên
 */
async function readHolidayBody(request: Request): Promise<{ body: HolidayInput; errorResponse: null } | { body: null; errorResponse: Response }> {
  const parsed = HolidayInputSchema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return { body: parsed.data, errorResponse: null };
  return { body: null, errorResponse: apiError(422, parsed.error.issues[0]?.message ?? HOLIDAY_MESSAGES[422]) };
}

/**
 * Thêm hoặc sửa, rồi trả câu trả theo kết quả.
 * @param request    request MSW chặn được
 * @param holidayId  id ngày nghỉ cần sửa; không có = thêm mới
 * @returns          ngày nghỉ (thêm: 201) · 401 · 403 · 422 · 404 · 409 trùng ngày
 */
async function respondSave(request: Request, holidayId?: string): Promise<Response> {
  await delay(MOCK_DELAY_MS);
  const deniedResponse = await accessError();
  if (deniedResponse) return deniedResponse;
  const { body, errorResponse } = await readHolidayBody(request);
  if (errorResponse) return errorResponse;

  const saved = saveHoliday(body, holidayId);
  if (saved === 'notFound') return apiError(404, HOLIDAY_MESSAGES[404]);
  if ('overlaps' in saved) return apiError(409, HOLIDAY_MESSAGES.overlaps(saved.overlaps));
  return HttpResponse.json<Holiday>(saved, { status: holidayId ? 200 : 201 });
}

export const holidayHandlers = [
  // Mọi ngày nghỉ
  http.get(api(ENDPOINTS.holidays.list), async () => {
    await delay(MOCK_DELAY_MS);
    const deniedResponse = await accessError();
    if (deniedResponse) return deniedResponse;
    return HttpResponse.json<HolidaysResponse>({ holidays: getHolidays() });
  }),

  // Thêm, sửa
  http.post(api(ENDPOINTS.holidays.list), ({ request }) => respondSave(request)),
  http.put(api(ENDPOINTS.holidays.holiday), ({ request, params }) => respondSave(request, String(params.holidayId))),

  // Xóa
  http.delete(api(ENDPOINTS.holidays.holiday), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const deniedResponse = await accessError();
    if (deniedResponse) return deniedResponse;
    if (!deleteHoliday(String(params.holidayId))) return apiError(404, HOLIDAY_MESSAGES[404]);
    return new HttpResponse(null, { status: 204 });
  }),
];
