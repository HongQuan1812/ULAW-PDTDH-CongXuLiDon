/* Hook gọi API hồ sơ cá nhân. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  profileCccdPath,
  profileFormsPath,
  profileHandledFormsPath,
  profileMainStudentPath,
  profilePath,
  profileStudentsPath,
  type FormSummary,
  type HandledFormSummary,
  type HandledFormsResponse,
  type MyFormsResponse,
  type FullCccdResponse,
  type Profile,
  type Session,
  type SetMainStudentRequest,
  type StudentsResponse,
  type UpdateProfileRequest,
} from '@ulaw/shared';
import { SESSION_KEY } from './auth';
import { apiFetch } from './client';
import { listPath, toListPage, type ListSource } from './lists';

/** Khóa lưu tạm hồ sơ của mình trong TanStack Query. */
export const MY_PROFILE_KEY = ['profile', 'me'] as const;
/** Khóa lưu tạm số CCCD đầy đủ của mình. */
const MY_FULL_CCCD_KEY = ['profile', 'me', 'cccd'] as const;
/** Khóa lưu tạm thông tin sinh viên của mình. */
const MY_STUDENTS_KEY = ['profile', 'me', 'students'] as const;

/**
 * Khóa lưu tạm thông tin sinh viên của người khác.
 * @param userId  id người dùng
 * @returns       khóa TanStack Query
 */
function personStudentsKey(userId: string) {
  return ['profile', 'person', userId, 'students'] as const;
}

/**
 * Hồ sơ của mình (họ tên, email, SĐT, CCCD đã che). Thông tin sinh viên lấy riêng bằng useMyStudents.
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
 * Thông tin sinh viên của mình (các MSSV, MSSV chính), lấy từ database trường. Tải riêng với hồ sơ:
 * database trường lỗi thì chỉ phần này lỗi.
 * @returns  kết quả useQuery; data = { students, mainStudentId }; database trường lỗi thì lỗi 503
 */
export function useMyStudents() {
  return useQuery({
    queryKey: MY_STUDENTS_KEY,
    queryFn: () => apiFetch<StudentsResponse>(ENDPOINTS.profile.myStudents),
  });
}

/**
 * Thông tin sinh viên của người khác (các MSSV, MSSV chính), lấy từ database trường.
 * @param userId  id người dùng cần xem
 * @returns       kết quả useQuery; data = { students, mainStudentId }; không có quyền / không có người đó / database trường lỗi thì lỗi 403 / 404 / 503
 */
export function usePersonStudents(userId: string) {
  return useQuery({
    queryKey: personStudentsKey(userId),
    queryFn: () => apiFetch<StudentsResponse>(profileStudentsPath(userId)),
  });
}

/**
 * Hồ sơ của người khác (cán bộ có quyền viewApplicant xem hồ sơ người nộp đơn). CCCD đã che.
 * @param userId   id người dùng cần xem
 * @param enabled  false thì không tải (vd trang nộp đơn của chính mình, không có người nộp thay); mặc định true
 * @returns        kết quả useQuery; data = hồ sơ; không có quyền hoặc không có người đó thì lỗi 403 / 404
 */
export function usePersonProfile(userId: string, enabled = true) {
  return useQuery({
    queryKey: ['profile', 'person', userId] as const,
    queryFn: () => apiFetch<Profile>(profilePath(userId)),
    enabled,
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
 * Nguồn bảng "Đơn đã nộp" của một người khác: từng trang trong các đơn người đó đã nộp.
 * @param userId  id người dùng cần xem
 * @returns       nguồn của bảng (dùng với useServerTable; nhớ giữ nguyên tham chiếu bằng useMemo)
 */
export function personFormsSource(userId: string): ListSource<FormSummary> {
  return {
    queryKey: ['profile', 'person', userId, 'forms'],
    fetchPage: async (listQuery) => {
      const { forms, ...pageMeta } = await apiFetch<MyFormsResponse>(listPath(profileFormsPath(userId), listQuery));
      return toListPage(forms, pageMeta);
    },
  };
}

/**
 * Nguồn bảng "Đơn phụ trách" của một cán bộ khác: từng trang trong các đơn người đó tiếp nhận hoặc đang xử lí.
 * Chỉ dùng khi người đó là cán bộ và người xem có quyền viewAll.
 * @param userId  id cán bộ cần xem
 * @returns       nguồn của bảng (dùng với useServerTable; nhớ giữ nguyên tham chiếu bằng useMemo)
 */
export function personHandledFormsSource(userId: string): ListSource<HandledFormSummary> {
  return {
    queryKey: ['profile', 'person', userId, 'handled-forms'],
    fetchPage: async (listQuery) => {
      const { forms, ...pageMeta } = await apiFetch<HandledFormsResponse>(listPath(profileHandledFormsPath(userId), listQuery));
      return toListPage(forms, pageMeta);
    },
  };
}

/**
 * Chọn MSSV chính (hiện trên trang thông tin, điền vào file Word khi xuất đơn).
 * @returns  kết quả useMutation; gọi mutateAsync({ studentId }). Thành công thì thông tin sinh viên mới được lưu ngay.
 */
export function useSetMainStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetMainStudentRequest) =>
      apiFetch<StudentsResponse>(ENDPOINTS.profile.myMainStudent, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (studentsResponse) => queryClient.setQueryData(MY_STUDENTS_KEY, studentsResponse),
  });
}

/**
 * Chọn MSSV chính cho người khác (Admin, quyền editApplicant).
 * @param userId  id người được chọn MSSV chính
 * @returns       kết quả useMutation; gọi mutateAsync({ studentId }). Thành công thì thông tin sinh viên mới của người đó được lưu ngay.
 */
export function useSetPersonMainStudent(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetMainStudentRequest) =>
      apiFetch<StudentsResponse>(profileMainStudentPath(userId), { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (studentsResponse) => queryClient.setQueryData(personStudentsKey(userId), studentsResponse),
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
