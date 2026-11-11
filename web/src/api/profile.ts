/* Hook gọi API hồ sơ cá nhân. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  profileCccdPath,
  profileFormsPath,
  profileHandledFormsPath,
  profilePath,
  type HandledFormsResponse,
  type MyFormsResponse,
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
 * Hồ sơ của người khác (cán bộ có quyền viewApplicant xem hồ sơ người nộp đơn). CCCD đã che.
 * @param userId  id người dùng cần xem
 * @returns       kết quả useQuery; data = hồ sơ; không có quyền hoặc không có người đó thì lỗi 403 / 404
 */
export function usePersonProfile(userId: string) {
  return useQuery({
    queryKey: ['profile', 'person', userId] as const,
    queryFn: () => apiFetch<Profile>(profilePath(userId)),
  });
}

/**
 * Số CCCD đầy đủ của người khác. Chỉ gọi API khi `enabled` là true (người xem bấm "Hiện").
 * @param userId   id người dùng cần xem
 * @param enabled  true thì tải số đầy đủ
 * @returns        kết quả useQuery; data.cccd = số đầy đủ
 */
export function usePersonFullCccd(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['profile', 'person', userId, 'cccd'] as const,
    queryFn: () => apiFetch<FullCccdResponse>(profileCccdPath(userId)),
    enabled,
    // Dữ liệu nhạy cảm: không giữ lại lâu sau khi người xem bấm "Ẩn"
    gcTime: 0,
  });
}

/**
 * Các đơn một người khác đã nộp.
 * @param userId  id người dùng cần xem
 * @returns       kết quả useQuery; data = mảng đơn (FormSummary[])
 */
export function usePersonForms(userId: string) {
  return useQuery({
    queryKey: ['profile', 'person', userId, 'forms'] as const,
    queryFn: () => apiFetch<MyFormsResponse>(profileFormsPath(userId)),
    select: (response) => response.forms,
  });
}

/**
 * Các đơn một cán bộ khác tiếp nhận hoặc đang xử lí (mục "Đơn phụ trách" trên trang thông tin người khác).
 * @param userId   id cán bộ cần xem
 * @param enabled  true thì tải (chỉ khi người đó là cán bộ và người xem có quyền viewAll)
 * @returns        kết quả useQuery; data = mảng đơn kèm người tiếp nhận, người xử lí (HandledFormSummary[])
 */
export function usePersonHandledForms(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['profile', 'person', userId, 'handled-forms'] as const,
    queryFn: () => apiFetch<HandledFormsResponse>(profileHandledFormsPath(userId)),
    select: (response) => response.forms,
    enabled,
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
 *           (họ tên mới, đã bổ sung thông tin) được lưu ngay, hồ sơ và bảng Quản lí tài khoản được tải lại.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) =>
      apiFetch<Session>(ENDPOINTS.profile.me, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_KEY, session);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
      ]);
    },
  });
}
