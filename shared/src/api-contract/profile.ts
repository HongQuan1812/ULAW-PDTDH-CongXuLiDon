/* HỢP ĐỒNG nhóm API hồ sơ cá nhân: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import { CCCD_PATTERN, PHONE_PATTERN, VALIDATION_MESSAGES, isFullName } from '../validators';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const PROFILE_ENDPOINTS = {
  /** GET → Profile: hồ sơ của mình (CCCD đã che).
      PUT UpdateProfileRequest → Session: lưu họ tên, CCCD, SĐT của mình và đánh dấu đã bổ sung thông tin lần đầu */
  me: '/profile/me',
  /** GET → FullCccdResponse: số CCCD đầy đủ của mình (chỉ gọi khi người dùng bấm "Hiện") */
  myCccd: '/profile/me/cccd',
  /** PUT SetMainStudentRequest → Profile: chọn MSSV chính (hiện trên trang thông tin, điền vào file Word khi xuất đơn) */
  myMainStudent: '/profile/me/main-student',
  /** GET → Profile: hồ sơ của người khác (CCCD đã che), chỉ xem. Cần quyền viewApplicant; không có người dùng thì 404.
      Đặt sau /profile/me để 'me' không bị hiểu là id người dùng */
  person: '/profile/:userId',
  /** GET → FullCccdResponse: số CCCD đầy đủ của người khác (chỉ gọi khi người xem bấm "Hiện"). Cần quyền viewApplicant */
  personCccd: '/profile/:userId/cccd',
  /** GET → MyFormsResponse: các đơn người đó đã nộp. Cần quyền viewApplicant */
  personForms: '/profile/:userId/forms',
} as const;

/**
 * Đường dẫn API hồ sơ của một người dùng khác.
 * @param userId  id người dùng
 * @returns       vd '/profile/sv-2'
 */
export function profilePath(userId: string): string {
  return PROFILE_ENDPOINTS.person.replace(':userId', encodeURIComponent(userId));
}

/**
 * Đường dẫn API số CCCD đầy đủ của một người dùng khác.
 * @param userId  id người dùng
 * @returns       vd '/profile/sv-2/cccd'
 */
export function profileCccdPath(userId: string): string {
  return PROFILE_ENDPOINTS.personCccd.replace(':userId', encodeURIComponent(userId));
}

/**
 * Đường dẫn API các đơn đã nộp của một người dùng khác.
 * @param userId  id người dùng
 * @returns       vd '/profile/sv-2/forms'
 */
export function profileFormsPath(userId: string): string {
  return PROFILE_ENDPOINTS.personForms.replace(':userId', encodeURIComponent(userId));
}

/* ---------- Dữ liệu gửi / nhận ---------- */

/**
 * Body của PUT /profile/me. Họ và tên bắt buộc; CCCD và số điện thoại không bắt buộc
 * (gửi chuỗi rỗng "" nếu không có), có nhập thì phải đúng định dạng. Các ô được cắt khoảng trắng đầu và cuối.
 */
export const UpdateProfileRequestSchema = z.object({
  name: z.string().trim().refine(isFullName, VALIDATION_MESSAGES.fullName),
  cccd: z.string().trim().refine((cccdText) => cccdText === '' || CCCD_PATTERN.test(cccdText), VALIDATION_MESSAGES.cccd),
  phone: z.string().trim().refine((phoneText) => phoneText === '' || PHONE_PATTERN.test(phoneText), VALIDATION_MESSAGES.phone),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

/**
 * Thông tin của một MSSV, lấy từ database trường, chỉ xem, không sửa được.
 * MSSV luôn có; các mục khác database trường có thể thiếu (vd không có lớp, chưa có ngành và khóa) thì null.
 */
export const StudentInfoSchema = z.object({
  studentId: z.string(),
  className: z.string().nullable(),
  trainingMode: z.string().nullable(),
  major: z.string().nullable(),
  currentCohort: z.string().nullable(),
  originalCohort: z.string().nullable(),
});
export type StudentInfo = z.infer<typeof StudentInfoSchema>;

/** Tên hiện trên giao diện của từng mục thông tin sinh viên, theo đúng thứ tự hiện (như STUDENT_FIELDS của bản mẫu). */
export const STUDENT_INFO_LABELS: ReadonlyArray<{ key: keyof StudentInfo; label: string }> = [
  { key: 'studentId', label: 'MSSV' },
  { key: 'className', label: 'Lớp' },
  { key: 'trainingMode', label: 'Hình thức đào tạo' },
  { key: 'major', label: 'Ngành' },
  { key: 'currentCohort', label: 'Khóa học hiện tại' },
  { key: 'originalCohort', label: 'Khóa học gốc' },
];

/** Hồ sơ của mình, trả về từ GET /profile/me. CCCD là dữ liệu nhạy cảm nên chỉ trả dạng che. */
export const ProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  /** null = chưa có */
  phone: z.string().nullable(),
  /** vd "079•••••1234"; null = chưa có CCCD */
  maskedCccd: z.string().nullable(),
  /**
   * Các MSSV gắn với email này (một email có thể gắn với nhiều MSSV). MSSV trùng phần trước @ của email đứng đầu.
   * [] = không phải sinh viên, hoặc database trường không có MSSV nào của email này.
   */
  students: z.array(StudentInfoSchema),
  /** MSSV chính, luôn là một MSSV trong `students` (chưa chọn thì máy chủ trả MSSV đầu); null khi `students` rỗng */
  mainStudentId: z.string().nullable(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** Body của PUT /profile/me/main-student: MSSV muốn dùng làm MSSV chính, phải thuộc email của mình. */
export const SetMainStudentRequestSchema = z.object({ studentId: z.string().trim().min(1) });
export type SetMainStudentRequest = z.infer<typeof SetMainStudentRequestSchema>;

/** Body trả về từ GET /profile/me/cccd. */
export const FullCccdResponseSchema = z.object({
  /** null = chưa có CCCD */
  cccd: z.string().nullable(),
});
export type FullCccdResponse = z.infer<typeof FullCccdResponseSchema>;

/* ---------- Câu thông báo, theo mã HTTP (lỗi hay thành công đều ghi ở đây) ---------- */

export const PROFILE_MESSAGES = {
  /** PUT /profile/me thành công */
  200: 'Đã lưu thông tin cá nhân',
  401: 'Bạn chưa đăng nhập.',
  /** GET /profile/:userId (và /cccd, /forms) khi không có quyền viewApplicant */
  403: 'Bạn không có quyền xem hồ sơ người khác.',
  /** GET /profile/:userId (và /cccd, /forms) khi không có người dùng này */
  404: 'Không có người dùng này.',
  /** PUT /profile/me: CCCD đã thuộc tài khoản khác */
  409: 'Số CCCD này đã thuộc tài khoản khác.',
  /** PUT /profile/me: body sai định dạng */
  422: 'Thông tin chưa hợp lệ.',
} as const;

/** Câu thông báo của PUT /profile/me/main-student. */
export const MAIN_STUDENT_MESSAGES = {
  200: (studentId: string) => `Đã chọn MSSV ${studentId} làm thông tin chính`,
  /** MSSV gửi lên không thuộc email của mình */
  422: 'MSSV này không thuộc tài khoản của bạn.',
} as const;
