/* Hook gọi API Quản lí tài khoản (chỉ vai trò có quyền manageAccounts). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  accountPath,
  type Account,
  type AccountCccdsResponse,
  type AccountsResponse,
  type CreateAccountRequest,
  type UpdateAccountRequest,
} from '@ulaw/shared';
import { SESSION_KEY } from './auth';
import { apiFetch } from './client';

/** Khóa lưu tạm danh sách tài khoản trong TanStack Query. */
export const ACCOUNTS_KEY = ['accounts'] as const;

/**
 * Mọi tài khoản (người nộp đơn và cán bộ), CCCD đã che.
 * @returns  kết quả useQuery; data = mảng tài khoản (Account[])
 */
export function useAccounts() {
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: () => apiFetch<AccountsResponse>(ENDPOINTS.accounts.list),
    select: (response) => response.accounts,
  });
}

/**
 * CCCD đầy đủ của mọi tài khoản; chỉ tải khi bấm "Hiện CCCD", không giữ lại sau khi ẩn.
 * @param enabled  true = tải
 * @returns        kết quả useQuery; data = CCCD theo id tài khoản
 */
export function useAccountCccds(enabled: boolean) {
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, 'cccds'],
    queryFn: () => apiFetch<AccountCccdsResponse>(ENDPOINTS.accounts.cccds),
    select: (response) => response.cccds,
    enabled,
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
