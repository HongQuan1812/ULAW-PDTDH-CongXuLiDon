/* API giả: Quản lí tài khoản (xem mọi tài khoản, hiện CCCD, tạo, sửa). Chỉ vai trò có quyền manageAccounts;
   riêng sửa thì quyền editApplicant cũng được, nhưng không được đổi vai trò. */
import { delay, http, HttpResponse } from 'msw';
import {
  ACCOUNT_MESSAGES,
  CreateAccountRequestSchema,
  ENDPOINTS,
  UpdateAccountRequestSchema,
  can,
  type Account,
  type AccountCccdsResponse,
  type AccountsResponse,
  type Permission,
  type Session,
} from '@ulaw/shared';
import { createAccount, findPerson, getAccountCccds, getAccounts, readSession, updateAccount } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

/**
 * Kiểm tra người đang đăng nhập có một trong các quyền cần có.
 * @param permissions  các quyền chấp nhận, mặc định chỉ manageAccounts
 * @returns            session: phiên của người đó · errorResponse: câu trả lỗi nếu chưa đăng nhập (401) hoặc không có quyền (403)
 */
function managerSession(
  permissions: readonly Permission[] = ['manageAccounts'],
): { session: Session; errorResponse?: undefined } | { session?: undefined; errorResponse: Response } {
  const session = readSession();
  if (!session) return { errorResponse: apiError(401, ACCOUNT_MESSAGES[401]) };
  if (!permissions.some((permission) => can(session.role, permission))) return { errorResponse: apiError(403, ACCOUNT_MESSAGES[403]) };
  return { session };
}

export const accountHandlers = [
  // Mọi tài khoản (CCCD che)
  http.get(api(ENDPOINTS.accounts.list), async () => {
    await delay(MOCK_DELAY_MS);
    const { errorResponse } = managerSession();
    if (errorResponse) return errorResponse;
    return HttpResponse.json<AccountsResponse>({ accounts: getAccounts() });
  }),

  // CCCD đầy đủ của mọi tài khoản (bấm "Hiện CCCD"). Đặt trước /accounts/:userId
  http.get(api(ENDPOINTS.accounts.cccds), async () => {
    await delay(MOCK_DELAY_MS);
    const { errorResponse } = managerSession();
    if (errorResponse) return errorResponse;
    return HttpResponse.json<AccountCccdsResponse>({ cccds: getAccountCccds() });
  }),

  // Tạo tài khoản: kiểm tra body, email và CCCD chưa có tài khoản nào dùng
  http.post(api(ENDPOINTS.accounts.list), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const { errorResponse } = managerSession();
    if (errorResponse) return errorResponse;

    // Body sai thì 422, kèm câu báo lỗi của ô đầu tiên bị sai
    const parsed = CreateAccountRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, parsed.error.issues[0]?.message ?? ACCOUNT_MESSAGES[422]);

    // Email / CCCD trùng thì 409; xong trả tài khoản mới
    const created = createAccount(parsed.data);
    if (!created.ok) return apiError(created.status, created.message);
    return HttpResponse.json<Account>(created.account, { status: 201 });
  }),

  // Sửa tài khoản (Quản lí tài khoản, hoặc "Sửa thông tin" ở trang thông tin người khác): không tự đổi vai trò, CCCD không trùng
  http.put(api(ENDPOINTS.accounts.account), async ({ request, params }) => {
    await delay(MOCK_DELAY_MS);
    const { session, errorResponse } = managerSession(['manageAccounts', 'editApplicant']);
    if (errorResponse) return errorResponse;

    // Body sai thì 422
    const parsed = UpdateAccountRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, parsed.error.issues[0]?.message ?? ACCOUNT_MESSAGES[422]);

    // Chỉ có editApplicant mà đổi vai trò thì 403
    const currentRole = findPerson(String(params.userId))?.role;
    if (currentRole && parsed.data.role !== currentRole && !can(session.role, 'manageAccounts')) {
      return apiError(403, ACCOUNT_MESSAGES.roleForbidden);
    }

    // Không có tài khoản 404, tự đổi vai trò 422, CCCD trùng 409; xong trả tài khoản sau khi sửa
    const updated = updateAccount(String(params.userId), parsed.data, session.user);
    if (!updated.ok) return apiError(updated.status, updated.message);
    return HttpResponse.json<Account>(updated.account);
  }),
];
