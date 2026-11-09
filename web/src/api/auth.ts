/* Hook gọi API đăng nhập: phiên hiện tại, đăng nhập thử, đăng xuất. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS, type DevLoginRequest, type Session } from '@ulaw/shared';
import { ApiError, apiFetch } from './client';

/** Khóa lưu tạm phiên đăng nhập trong TanStack Query. */
export const SESSION_KEY = ['session'] as const;

/**
 * Lấy phiên đăng nhập hiện tại từ máy chủ.
 * @returns  phiên; chưa đăng nhập (401) thì null
 */
async function fetchSession(): Promise<Session | null> {
  try {
    return await apiFetch<Session>(ENDPOINTS.auth.me);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/**
 * Phiên đăng nhập hiện tại. Chỉ gọi API một lần, sau đó dùng lại kết quả đã lưu.
 * @returns  kết quả useQuery; data = phiên, hoặc null nếu chưa đăng nhập
 */
export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: Infinity });
}

/* JUST FOR DEMO: START · đăng nhập thử theo vai trò, chỉ có ở API giả. Bản thật: Google OAuth. */
/**
 * Đăng nhập thử theo vai trò (chỉ có ở API giả).
 * @returns  kết quả useMutation; gọi mutate({ role }) để đăng nhập
 */
export function useDevLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DevLoginRequest) =>
      apiFetch<Session>(ENDPOINTS.auth.devLogin, { method: 'POST', body: JSON.stringify(body) }),
    // Lưu phiên mới để cả ứng dụng thấy ngay, không cần gọi lại /auth/me
    onSuccess: (session) => queryClient.setQueryData(SESSION_KEY, session),
  });
}
/* JUST FOR DEMO: END */

/**
 * Đăng xuất.
 * @returns  kết quả useMutation; gọi mutate() để đăng xuất
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(ENDPOINTS.auth.logout, { method: 'POST' }),
    // Xóa mọi dữ liệu đã lưu của người vừa đăng xuất, rồi đánh dấu chưa đăng nhập
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(SESSION_KEY, null);
    },
  });
}
