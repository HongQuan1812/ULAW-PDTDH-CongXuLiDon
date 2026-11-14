/* Hook gọi API đăng nhập: phiên hiện tại, đăng nhập, đăng xuất. */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ENDPOINTS, type LoginRequest, type LoginResponse, type Session } from '@ulaw/shared';
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
 * Đăng nhập: nút "Đăng nhập bằng email trường", ô đổi vai trò (thử nghiệm). Máy chủ quyết định đăng nhập cách nào:
 * trả phiên luôn (đăng nhập thử) thì lưu phiên; trả đường dẫn thì chuyển trình duyệt sang Google
 * (rời khỏi ứng dụng, máy chủ chuyển về trang `from` sau khi xong).
 * @returns  kết quả useMutation; gọi mutate({ from, role, email }) để đăng nhập
 */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      apiFetch<LoginResponse>(ENDPOINTS.auth.login, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (loginResponse) => {
      // Sang Google
      if (loginResponse.kind === 'redirect') {
        window.location.assign(loginResponse.url);
        return;
      }

      // Đã đăng nhập: lưu phiên để cả ứng dụng thấy ngay; các bảng bắt đầu lại từ đầu
      clearTableStates();
      queryClient.setQueryData(SESSION_KEY, loginResponse.session);
    },
  });
}

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
