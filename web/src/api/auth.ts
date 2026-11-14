/* Hook gọi API đăng nhập: phiên hiện tại, đăng nhập Google, đăng nhập thử, đăng xuất. */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ENDPOINTS, type DevLoginRequest, type Session } from '@ulaw/shared';
import { clearTableStates } from '../components/table/tableStateStore';
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

/**
 * Xử lí lỗi của mọi lần gọi API: máy chủ báo chưa đăng nhập (401, vd phiên hết hạn) thì coi như đã đăng xuất.
 * Khung ứng dụng thấy phiên null sẽ chuyển về trang Đăng nhập, nhớ trang đang mở để quay lại sau khi đăng nhập.
 * @param queryClient  nơi lưu tạm kết quả gọi API
 * @param error        lỗi vừa xảy ra
 */
export function handleUnauthorized(queryClient: QueryClient, error: unknown): void {
  if (!(error instanceof ApiError) || error.status !== 401) return;

  // Đánh dấu chưa đăng nhập, rồi bỏ dữ liệu của phiên cũ (đăng nhập lại có thể là người khác)
  queryClient.setQueryData(SESSION_KEY, null);
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
}

/**
 * Đường dẫn bắt đầu đăng nhập Google. Trình duyệt mở thẳng đường này (không gọi bằng fetch):
 * máy chủ chuyển sang Google, xong thì chuyển về trang `from`.
 * @param from  trang trong giao diện cần mở sau khi đăng nhập, vd '/quan-li-don'; bỏ trống = trang chính của vai trò
 * @returns     vd '/api/auth/google?from=%2Fquan-li-don'
 */
export function googleLoginUrl(from?: string): string {
  const query = from ? `?${new URLSearchParams({ from }).toString()}` : '';
  return `/api${ENDPOINTS.auth.googleStart}${query}`;
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
    // Lưu phiên mới để cả ứng dụng thấy ngay, không cần gọi lại /auth/me;
    // các bảng bắt đầu lại từ đầu (không tìm, không sắp xếp, không lọc)
    onSuccess: (session) => {
      clearTableStates();
      queryClient.setQueryData(SESSION_KEY, session);
    },
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
    // Đánh dấu chưa đăng nhập (trang đang theo dõi phiên thấy ngay và chuyển về Đăng nhập),
    // rồi xóa mọi dữ liệu khác của người vừa đăng xuất (kể cả cách xem các bảng). Không dùng clear(): nó gỡ luôn phiên
    // đang được theo dõi, nên trang không nhận được giá trị null và đứng yên.
    onSuccess: () => {
      queryClient.setQueryData(SESSION_KEY, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
      clearTableStates();
    },
  });
}
