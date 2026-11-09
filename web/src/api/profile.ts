/* Hook gọi API hồ sơ cá nhân. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS, type Session, type UpdateProfileRequest } from '@ulaw/shared';
import { SESSION_KEY } from './auth';
import { apiFetch } from './client';

/**
 * Lưu họ tên, CCCD, SĐT của mình (dùng khi bổ sung thông tin lần đầu).
 * @returns  kết quả useMutation; gọi mutateAsync({ name, cccd, phone }). Thành công thì phiên mới
 *           (họ tên mới, đã bổ sung thông tin) được lưu ngay, nên cả ứng dụng thấy luôn.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) =>
      apiFetch<Session>(ENDPOINTS.profile.me, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (session) => queryClient.setQueryData(SESSION_KEY, session),
  });
}
