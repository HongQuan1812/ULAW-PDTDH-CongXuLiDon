/* HỢP ĐỒNG nhóm API hồ sơ cá nhân: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import { CCCD_PATTERN, PHONE_PATTERN, VALIDATION_MESSAGES, isFullName } from '../validators';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const PROFILE_ENDPOINTS = {
  /** PUT UpdateProfileRequest → Session: lưu họ tên, CCCD, SĐT của mình và đánh dấu đã bổ sung thông tin lần đầu */
  me: '/profile/me',
} as const;

/* ---------- Dữ liệu gửi / nhận ---------- */

/**
 * Body của PUT /profile/me. Họ và tên bắt buộc; CCCD và số điện thoại không bắt buộc
 * (gửi chuỗi rỗng "" nếu không có), có nhập thì phải đúng định dạng. Các ô được cắt khoảng trắng đầu và cuối.
 */
export const UpdateProfileRequestSchema = z.object({
  name: z.string().trim().refine(isFullName, VALIDATION_MESSAGES.fullName),
  cccd: z.string().trim().refine((value) => value === '' || CCCD_PATTERN.test(value), VALIDATION_MESSAGES.cccd),
  phone: z.string().trim().refine((value) => value === '' || PHONE_PATTERN.test(value), VALIDATION_MESSAGES.phone),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

/* ---------- Câu thông báo, theo mã HTTP (lỗi hay thành công đều ghi ở đây) ---------- */

export const PROFILE_MESSAGES = {
  /** PUT /profile/me thành công */
  200: 'Đã lưu thông tin cá nhân',
  401: 'Bạn chưa đăng nhập.',
  /** PUT /profile/me: CCCD đã thuộc tài khoản khác */
  409: 'Số CCCD này đã thuộc tài khoản khác.',
  /** PUT /profile/me: body sai định dạng */
  422: 'Thông tin chưa hợp lệ.',
} as const;
