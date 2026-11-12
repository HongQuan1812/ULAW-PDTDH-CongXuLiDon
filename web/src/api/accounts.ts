/* Hook gọi API Quản lí tài khoản (chỉ vai trò có quyền manageAccounts). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  accountPath,
  userIdsParams,
  type Account,
  type AccountCccdsResponse,
  type AccountsResponse,
  type CreateAccountRequest,
  type UpdateAccountRequest,
} from '@ulaw/shared';
import { SESSION_KEY } from './auth';
import { apiFetch } from './client';
import { listPath, toListPage, type ListSource } from './lists';

/** Khóa lưu tạm danh sách tài khoản trong TanStack Query. */
export const ACCOUNTS_KEY = ['accounts'] as const;

/** Bảng Quản lí tài khoản: từng trang trong mọi tài khoản (người nộp đơn và cán bộ), CCCD đã che. */
export const ACCOUNTS_SOURCE: ListSource<Account> = {
  queryKey: ACCOUNTS_KEY,
  fetchPage: async (listQuery) => {
    const { accounts, ...pageMeta } = await apiFetch<AccountsResponse>(listPath(ENDPOINTS.accounts.list, listQuery));
    return toListPage(accounts, pageMeta);
  },
};

/**
 * CCCD đầy đủ của các tài khoản đang có trên trang bảng; chỉ tải khi bấm "Hiện CCCD", không giữ lại sau khi ẩn.
 * @param enabled     true = tải
 * @param accountIds  id các tài khoản đang có trên trang bảng
 * @returns           kết quả useQuery; data = CCCD theo id tài khoản
 */
export function useAccountCccds(enabled: boolean, accountIds: readonly string[]) {
  const sortedIds = [...new Set(accountIds)].sort();
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, 'cccds', sortedIds],
    queryFn: () => apiFetch<AccountCccdsResponse>(`${ENDPOINTS.accounts.cccds}?${new URLSearchParams(userIdsParams(sortedIds))}`),
    select: (response) => response.cccds,
    enabled: enabled && sortedIds.length > 0,
    gcTime: 0,
  });
}

/**
 * Tải lại những gì có thể đổi theo tài khoản: bảng tài khoản, phiên (sửa tài khoản của mình),
 * hồ sơ, các bảng đơn và trang chi tiết đơn (họ tên người nộp / người xử lí), danh sách chuyển giao,
 * loại đơn (họ tên người cập nhật).
 * @param queryClient  bộ nhớ tạm của TanStack Query
 */
function refreshAfterAccountChange(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
    queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
    queryClient.invalidateQueries({ queryKey: ['profile'] }),
    queryClient.invalidateQueries({ queryKey: ['forms'] }),
    queryClient.invalidateQueries({ queryKey: ['formTypes'] }),
  ]);
}

/**
 * Tạo tài khoản mới.
 * @returns  kết quả useMutation; gọi mutateAsync({ name, email, role, cccd, phone }) → tài khoản vừa tạo
 */
export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAccountRequest) =>
      apiFetch<Account>(ENDPOINTS.accounts.list, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => refreshAfterAccountChange(queryClient),
  });
}

/**
 * Sửa họ tên, CCCD, SĐT, vai trò của một tài khoản.
 * @returns  kết quả useMutation; gọi mutateAsync({ userId, accountInput }) → tài khoản sau khi sửa
 */
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accountInput }: { userId: string; accountInput: UpdateAccountRequest }) =>
      apiFetch<Account>(accountPath(userId), { method: 'PUT', body: JSON.stringify(accountInput) }),
    onSuccess: () => refreshAfterAccountChange(queryClient),
  });
}
