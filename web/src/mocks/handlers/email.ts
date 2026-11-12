/* API giả: Cấu hình email (xem, lưu, gửi thư thử). Chỉ vai trò có quyền manageEmail. */
import { delay, http, HttpResponse } from 'msw';
import {
  EMAIL_MESSAGES,
  ENDPOINTS,
  EmailSettingsSchema,
  SendTestEmailRequestSchema,
  can,
  type EmailSettings,
  type EmailSettingsResponse,
  type SendTestEmailResponse,
} from '@ulaw/shared';
import { getEmailSettings, readSession, saveEmailSettings } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

/* JUST FOR DEMO: START · API giả coi như máy chủ thư luôn kết nối được và không gửi thư thật.
   Máy chủ thật đọc địa chỉ gửi từ cấu hình SMTP (biến môi trường, cùng mật khẩu ứng dụng). */
const MAIL_SERVER_CONNECTED = true;
const SENDER_ADDRESS = 'daotao@hcmulaw.edu.vn';
/* JUST FOR DEMO: END */

/**
 * Kiểm tra người đang đăng nhập có quyền manageEmail.
 * @returns  câu trả lỗi nếu chưa đăng nhập (401) hoặc không có quyền (403); có quyền thì null
 */
function permissionError(): Response | null {
  const session = readSession();
  if (!session) return apiError(401, EMAIL_MESSAGES[401]);
  if (!can(session.role, 'manageEmail')) return apiError(403, EMAIL_MESSAGES[403]);
  return null;
}

/**
 * Câu trả cấu hình kèm địa chỉ gửi và tình trạng máy chủ thư.
 * @param settings  cấu hình
 * @returns         response JSON EmailSettingsResponse
 */
function settingsResponse(settings: EmailSettings): Response {
  return HttpResponse.json<EmailSettingsResponse>({ settings, senderAddress: SENDER_ADDRESS, mailServerConnected: MAIL_SERVER_CONNECTED });
}

export const emailHandlers = [
  // Cấu hình đang dùng
  http.get(api(ENDPOINTS.email.settings), async () => {
    await delay(MOCK_DELAY_MS);
    const errorResponse = permissionError();
    if (errorResponse) return errorResponse;
    return settingsResponse(getEmailSettings());
  }),

  // Lưu cả cấu hình: body sai thì 422 kèm câu báo của ô đầu tiên bị sai
  http.put(api(ENDPOINTS.email.settings), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const errorResponse = permissionError();
    if (errorResponse) return errorResponse;

    const parsed = EmailSettingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, parsed.error.issues[0]?.message ?? EMAIL_MESSAGES[422]);
    return settingsResponse(saveEmailSettings(parsed.data));
  }),

  // Gửi thư thử: kiểm tra body, máy chủ thư phải đang kết nối; API giả không gửi thư thật
  http.post(api(ENDPOINTS.email.test), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const errorResponse = permissionError();
    if (errorResponse) return errorResponse;

    const parsed = SendTestEmailRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, parsed.error.issues[0]?.message ?? EMAIL_MESSAGES[422]);
    if (!MAIL_SERVER_CONNECTED) return apiError(503, EMAIL_MESSAGES.mailServerDown);
    return HttpResponse.json<SendTestEmailResponse>({ message: EMAIL_MESSAGES.testSent(parsed.data.to) });
  }),
];
