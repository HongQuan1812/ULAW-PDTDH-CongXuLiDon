/* API giả: đăng nhập, phiên đăng nhập, đăng xuất. */
import { delay, http, HttpResponse } from 'msw';
import {
  AUTH_MESSAGES,
  LoginRequestSchema,
  ENDPOINTS,
  isSchoolEmail,
  type LoginResponse,
  type RoleId,
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

  // Đăng nhập (nút "Đăng nhập bằng email trường", ô đổi vai trò): backend giả luôn đăng nhập thử (không có Google)
  http.post(api(ENDPOINTS.auth.login), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const parsed = LoginRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, AUTH_MESSAGES[422]);
    const loggedIn = logInDemoAccount(parsed.data.role ?? 'nguoiNopDon', parsed.data.email);
    if (loggedIn instanceof Response) return loggedIn;
    return HttpResponse.json<LoginResponse>({ kind: 'session', session: loggedIn });
  }),

  // Đăng xuất
  http.post(api(ENDPOINTS.auth.logout), async () => {
    await delay(MOCK_DELAY_MS);
    writeSession(null);
    return new HttpResponse(null, { status: 204 });
  }),
];

/**
 * Đăng nhập thử vào tài khoản mẫu của một vai trò, lưu phiên.
 * @param role   vai trò
 * @param email  email giả làm email Google (không bắt buộc); bỏ trống = email của tài khoản mẫu
 * @returns      Session; lỗi thì response lỗi (404 hết tài khoản vai trò đó, 403 email ngoài trường)
 */
function logInDemoAccount(role: RoleId, email: string | undefined): Session | Response {
  // Tài khoản đăng nhập thử của vai trò này (Admin có thể đã đổi vai trò của mọi tài khoản vai trò này thì 404)
  const userId = demoAccountFor(role);
  if (!userId) return apiError(404, AUTH_MESSAGES.noDemoAccount);

  // Chỉ cho email trường vào (backend thật cũng kiểm tra lại như vậy); có email thử thì kiểm tra email đó
  const loginEmail = email ?? getProfile(userId).email;
  if (!isSchoolEmail(loginEmail)) return apiError(403, AUTH_MESSAGES[403](loginEmail));

  // Lưu phiên
  writeSession(userId);
  return toSession(userId);
}
