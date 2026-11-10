/* HỢP ĐỒNG nhóm API đăng nhập: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import { ROLE_IDS } from '../aux-schema/accounts--roles';
import { SCHOOL_EMAIL_DOMAINS } from '../validators';

/* ---------- Đường dẫn (phần sau /api, vd '/auth/me' → GET /api/auth/me) ---------- */

export const AUTH_ENDPOINTS = {
  /** GET: phiên đăng nhập hiện tại → Session; chưa đăng nhập → 401 */
  me: '/auth/me',
  /* JUST FOR DEMO: START · chỉ có ở API giả, backend thật dùng Google OAuth */
  /** POST DevLoginRequest → Session */
  devLogin: '/auth/dev-login',
  /* JUST FOR DEMO: END */
  /** POST: đăng xuất → 204 */
  logout: '/auth/logout',
} as const;

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Người đang đăng nhập. */
export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

/** Phiên đăng nhập: ai đang dùng và với vai trò gì. Trả về từ GET /auth/me, POST /auth/dev-login. */
export const SessionSchema = z.object({
  user: SessionUserSchema,
  role: z.enum(ROLE_IDS),
  /** false = lần đầu đăng nhập, chưa xác nhận họ tên: giao diện chuyển sang màn Bổ sung thông tin */
  profileCompleted: z.boolean(),
});
export type Session = z.infer<typeof SessionSchema>;

/* JUST FOR DEMO: START · body của POST /auth/dev-login: chọn vai trò để đăng nhập thử */
export const DevLoginRequestSchema = z.object({ role: z.enum(ROLE_IDS) });
export type DevLoginRequest = z.infer<typeof DevLoginRequestSchema>;
/* JUST FOR DEMO: END */

/* ---------- Câu thông báo, theo mã HTTP (lỗi hay thành công đều ghi ở đây) ---------- */

export const AUTH_MESSAGES = {
  /** GET /auth/me khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
  /** Đăng nhập bằng email không phải email trường */
  403: (email: string) =>
    `Hãy đăng nhập bằng email trường (@${SCHOOL_EMAIL_DOMAINS[0]}). Email ${email} không được dùng cho cổng này.`,
  /** POST /auth/dev-login với body sai (vai trò không có trong danh sách) */
  422: 'Vai trò không hợp lệ.',
} as const;
