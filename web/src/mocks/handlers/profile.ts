/* API giả: hồ sơ cá nhân (lưu họ tên, CCCD, SĐT khi bổ sung thông tin lần đầu). */
import { delay, http, HttpResponse } from 'msw';
import { ENDPOINTS, PROFILE_MESSAGES, UpdateProfileRequestSchema, type Session } from '@ulaw/shared';
import { isCccdTaken, readSession, saveProfile, toSession } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

export const profileHandlers = [
  // Lưu hồ sơ của mình: kiểm tra body, kiểm tra CCCD không trùng, rồi trả phiên mới (đã bổ sung thông tin)
  http.put(api(ENDPOINTS.profile.me), async ({ request }) => {
    await delay(MOCK_DELAY_MS);

    // Chưa đăng nhập thì 401
    const session = readSession();
    if (!session) return apiError(401, PROFILE_MESSAGES[401]);

    // Body sai định dạng thì 422, kèm câu báo lỗi của ô đầu tiên bị sai
    const parsed = UpdateProfileRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, parsed.error.issues[0]?.message ?? PROFILE_MESSAGES[422]);

    // CCCD đã thuộc tài khoản khác thì 409
    const { cccd } = parsed.data;
    if (cccd && isCccdTaken(cccd, session.user.id)) return apiError(409, PROFILE_MESSAGES[409]);

    // Lưu rồi trả phiên mới để giao diện cập nhật họ tên và bỏ màn Bổ sung thông tin
    saveProfile(session.user.id, parsed.data);
    return HttpResponse.json<Session>(toSession(session.role));
  }),
];
