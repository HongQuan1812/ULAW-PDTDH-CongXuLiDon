/* API giả: Quản lí tài khoản (xem mọi tài khoản, hiện CCCD, tạo, sửa). Chỉ vai trò có quyền manageAccounts;
   riêng sửa thì quyền editApplicant cũng được, nhưng không được đổi vai trò. */
import { delay, http, HttpResponse } from 'msw';
import {
  ACCOUNT_LIST_DEFAULT_SORTING,
  ACCOUNT_LIST_FIELDS,
  ACCOUNT_MESSAGES,
  COMMON_MESSAGES,
  CreateAccountRequestSchema,
  ENDPOINTS,
  UpdateAccountRequestSchema,
  applyListQuery,
  can,
  type Account,
  type AccountCccdsResponse,
  type AccountsResponse,
  type Permission,
  type Session,
} from '@ulaw/shared';
import { createAccount, findPerson, getAccountCccds, getAccounts, readSession, updateAccount } from '../db';
import { MOCK_DELAY_MS, api, apiError, pickCccds, readListQuery, readUserIds } from '../http';

/**
 * Kiểm tra người đang đăng nhập có một trong các quyền cần có.
 * @param permissions  các quyền chấp nhận, mặc định chỉ manageAccounts
 * @returns            session: phiên của người đó · errorResponse: câu trả lỗi nếu chưa đăng nhập (401) hoặc không có quyền (403)
 */
async function managerSession(
  permissions: readonly Permission[] = ['manageAccounts'],
): Promise<{ session: Session; errorResponse?: undefined } | { session?: undefined; errorResponse: Response }> {
  const session = await readSession();
  if (!session) return { errorResponse: apiError(401, ACCOUNT_MESSAGES[401]) };
  if (!permissions.some((permission) => can(session.role, permission))) return { errorResponse: apiError(403, ACCOUNT_MESSAGES[403]) };
  return { session };
}

export const accountHandlers = [
  // Một trang trong mọi tài khoản (CCCD che, nhưng tìm được theo số CCCD đầy đủ)
  http.get(api(ENDPOINTS.accounts.list), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const { errorResponse } = await managerSession();
    if (errorResponse) return errorResponse;
    const listQuery = readListQuery(request, ACCOUNT_LIST_FIELDS);
    if (!listQuery) return apiError(422, COMMON_MESSAGES.listQuery);
    const cccdsByAccount = getAccountCccds();
    const fullCccdOf = (account: Account) => [cccdsByAccount[account.id] ?? ''];
    const { rows, ...pageMeta } = applyListQuery(getAccounts(), ACCOUNT_LIST_FIELDS, listQuery, ACCOUNT_LIST_DEFAULT_SORTING, fullCccdOf);
    return HttpResponse.json<AccountsResponse>({ accounts: rows, ...pageMeta });
  }),

  // CCCD đầy đủ của các tài khoản đang có trên trang bảng (bấm "Hiện CCCD"). Đặt trước /accounts/:userId
  http.get(api(ENDPOINTS.accounts.cccds), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const { errorResponse } = await managerSession();
    if (errorResponse) return errorResponse;
    const userIds = readUserIds(request);
    if (!userIds) return apiError(422, COMMON_MESSAGES.userIds);
    return HttpResponse.json<AccountCccdsResponse>({ cccds: pickCccds(getAccountCccds(), userIds) });
  }),

  // Tạo tài khoản: kiểm tra body, email và CCCD chưa có tài khoản nào dùng
  http.post(api(ENDPOINTS.accounts.list), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const { errorResponse } = await managerSession();
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
    const { session, errorResponse } = await managerSession(['manageAccounts', 'editApplicant']);
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
