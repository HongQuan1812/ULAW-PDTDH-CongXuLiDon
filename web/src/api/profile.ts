/* Hook gọi API hồ sơ cá nhân. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  type FullCccdResponse,
  type Profile,
  type Session,
  type SetMainStudentRequest,
  type UpdateProfileRequest,
} from '@ulaw/shared';
import { SESSION_KEY } from './auth';
import { apiFetch } from './client';

/** Khóa lưu tạm hồ sơ của mình trong TanStack Query. */
export const MY_PROFILE_KEY = ['profile', 'me'] as const;
/** Khóa lưu tạm số CCCD đầy đủ của mình. */
const MY_FULL_CCCD_KEY = ['profile', 'me', 'cccd'] as const;

/**
 * Hồ sơ của mình (họ tên, email, SĐT, CCCD đã che, thông tin sinh viên).
 * @returns  kết quả useQuery; data = hồ sơ
 */
export function useMyProfile() {
  return useQuery({
    queryKey: MY_PROFILE_KEY,
    queryFn: () => apiFetch<Profile>(ENDPOINTS.profile.me),
  });
}

/**
 * Số CCCD đầy đủ của mình. Chỉ gọi API khi `enabled` là true (người dùng bấm "Hiện").
 * @param enabled  true thì tải số đầy đủ
 * @returns        kết quả useQuery; data.cccd = số đầy đủ
 */
export function useMyFullCccd(enabled: boolean) {
  return useQuery({
    queryKey: MY_FULL_CCCD_KEY,
    queryFn: () => apiFetch<FullCccdResponse>(ENDPOINTS.profile.myCccd),
    enabled,
    // Dữ liệu nhạy cảm: không giữ lại lâu sau khi người dùng bấm "Ẩn"
    gcTime: 0,
  });
}

/**
 * Chọn MSSV chính (hiện trên trang thông tin, điền vào file Word khi xuất đơn).
 * @returns  kết quả useMutation; gọi mutateAsync({ studentId }). Thành công thì hồ sơ mới được lưu ngay.
 */
export function useSetMainStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetMainStudentRequest) =>
      apiFetch<Profile>(ENDPOINTS.profile.myMainStudent, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (profile) => queryClient.setQueryData(MY_PROFILE_KEY, profile),
  });
}

/**
 * Lưu họ tên, CCCD, SĐT của mình (bổ sung thông tin lần đầu, sửa thông tin).
 * @returns  kết quả useMutation; gọi mutateAsync({ name, cccd, phone }). Thành công thì phiên mới
 *           (họ tên mới, đã bổ sung thông tin) được lưu ngay, và hồ sơ được tải lại.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) =>
      apiFetch<Session>(ENDPOINTS.profile.me, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_KEY, session);
      return queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
