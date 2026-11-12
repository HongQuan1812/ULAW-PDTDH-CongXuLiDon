/* API giả: đăng nhập, phiên đăng nhập, đăng xuất. */
import { delay, http, HttpResponse } from 'msw';
import {
  AUTH_MESSAGES,
  DevLoginRequestSchema,
  ENDPOINTS,
  isSchoolEmail,
  type Session,
} from '@ulaw/shared';
import { demoAccountFor, getProfile, readSession, toSession, writeSession } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

export const authHandlers = [
  // Phiên hiện tại: chưa đăng nhập thì 401
  http.get(api(ENDPOINTS.auth.me), async () => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, AUTH_MESSAGES[401]);
    return HttpResponse.json<Session>(session);
  }),

  // Đăng nhập thử theo vai trò
  http.post(api(ENDPOINTS.auth.devLogin), async ({ request }) => {
    await delay(MOCK_DELAY_MS);

    // Kiểm tra body
    const parsed = DevLoginRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, AUTH_MESSAGES[422]);

    // Tài khoản đăng nhập thử của vai trò này (Admin có thể đã đổi vai trò của mọi tài khoản vai trò này thì 404)
    const userId = demoAccountFor(parsed.data.role);
    if (!userId) return apiError(404, AUTH_MESSAGES.noDemoAccount);

    // Chỉ cho email trường vào (backend thật cũng kiểm tra lại như vậy); có email thử thì kiểm tra email đó
    const email = parsed.data.email ?? getProfile(userId).email;
    if (!isSchoolEmail(email)) return apiError(403, AUTH_MESSAGES[403](email));

    // Lưu phiên và trả về
    writeSession(userId);
    return HttpResponse.json<Session>(toSession(userId));
  }),

  // Đăng xuất
  http.post(api(ENDPOINTS.auth.logout), async () => {
    await delay(MOCK_DELAY_MS);
    writeSession(null);
    return new HttpResponse(null, { status: 204 });
  }),
];
