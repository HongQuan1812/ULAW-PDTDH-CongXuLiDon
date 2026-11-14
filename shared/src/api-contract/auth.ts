/* HỢP ĐỒNG nhóm API đăng nhập: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import { ROLE_IDS } from '../aux-schema/accounts--roles';
import { SCHOOL_EMAIL_DOMAINS } from '../validators';

/* ---------- Đường dẫn (phần sau /api, vd '/auth/me' → GET /api/auth/me) ---------- */

export const AUTH_ENDPOINTS = {
  /** GET: phiên đăng nhập hiện tại → Session; chưa đăng nhập → 401 */
  me: '/auth/me',
  /** POST LoginRequest → LoginResponse: nút "Đăng nhập bằng email trường", ô đổi vai trò (thử nghiệm) trong menu.
   *  Máy chủ quyết định đăng nhập cách nào: đăng nhập thử luôn (trả Session), hoặc trả đường dẫn sang Google */
  login: '/auth/login',
  /** GET: Google chuyển về đây sau khi chọn tài khoản → tạo phiên rồi chuyển về giao diện (lỗi thì về trang Đăng nhập kèm GOOGLE_LOGIN_ERROR_PARAM) */
  googleCallback: '/auth/google/callback',
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

/** Phiên đăng nhập: ai đang dùng và với vai trò gì. Trả về từ GET /auth/me, POST /auth/login. */
export const SessionSchema = z.object({
  user: SessionUserSchema,
  role: z.enum(ROLE_IDS),
  /** false = lần đầu đăng nhập, chưa xác nhận họ tên: giao diện chuyển sang màn Bổ sung thông tin */
  profileCompleted: z.boolean(),
});
export type Session = z.infer<typeof SessionSchema>;

/** Câu báo khi body đăng nhập sai (vai trò lạ, email sai dạng). */
const LOGIN_INVALID_MESSAGE = 'Vai trò không hợp lệ.';

/** Body của POST /auth/login. */
export const LoginRequestSchema = z.object({
  /** trang trong giao diện cần mở sau khi đăng nhập Google, vd '/quan-li-don' */
  from: z.string().optional(),
  /* JUST FOR DEMO: START · chỉ dùng khi máy chủ đăng nhập thử; đăng nhập Google bỏ qua */
  /** vai trò của tài khoản mẫu muốn đăng nhập thử; bỏ trống = Người nộp đơn */
  role: z.enum(ROLE_IDS, LOGIN_INVALID_MESSAGE).optional(),
  /** email giả làm email Google trả về (thử email ngoài trường) */
  email: z.email(LOGIN_INVALID_MESSAGE).optional(),
  /* JUST FOR DEMO: END */
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Kết quả POST /auth/login: đã đăng nhập luôn (bản giả), hoặc phải chuyển trình duyệt sang Google. */
export const LoginResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('session'), session: SessionSchema }),
  z.object({ kind: z.literal('redirect'), url: z.string() }),
]);
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/* ---------- Đăng nhập Google: lỗi báo về trang Đăng nhập qua tham số trên đường dẫn ---------- */

/** Tên tham số mang mã lỗi, vd #/dang-nhap?loginError=notSchoolEmail&email=an@gmail.com */
export const GOOGLE_LOGIN_ERROR_PARAM = 'loginError';
/** Tên tham số mang email bị từ chối (chỉ có khi lỗi notSchoolEmail). */
export const GOOGLE_LOGIN_EMAIL_PARAM = 'email';

/** Mã lỗi đăng nhập Google:
 *  notSchoolEmail: email không thuộc SCHOOL_EMAIL_DOMAINS · notConfigured: máy chủ chưa có GOOGLE_CLIENT_ID / SECRET
 *  · failed: người dùng bấm Hủy, hết thời gian, hoặc Google trả lỗi */
export const GOOGLE_LOGIN_ERRORS = ['notSchoolEmail', 'notConfigured', 'failed'] as const;
export type GoogleLoginError = (typeof GOOGLE_LOGIN_ERRORS)[number];

/* ---------- Câu thông báo, theo mã HTTP (lỗi hay thành công đều ghi ở đây) ---------- */

export const AUTH_MESSAGES = {
  /** GET /auth/me khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
  /** Đăng nhập bằng email không phải email trường */
  403: (email: string) =>
    `Hãy đăng nhập bằng email trường (@${SCHOOL_EMAIL_DOMAINS[0]}). Email ${email} không được dùng cho cổng này.`,
  /** POST /auth/login với body sai (vai trò không có trong danh sách) */
  422: LOGIN_INVALID_MESSAGE,
  /** POST /auth/login khi đăng nhập thử (JUST FOR DEMO) mà Admin đã đổi hết tài khoản của vai trò này sang vai trò khác (404) */
  noDemoAccount: 'Không còn tài khoản nào có vai trò này để đăng nhập thử.',
  /** Đăng nhập Google khi máy chủ chưa cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (POST /auth/login trả 503) */
  googleNotConfigured: 'Cổng chưa bật đăng nhập bằng Google. Hãy báo quản trị viên.',
  /** Đăng nhập Google không thành công (bấm Hủy, quá lâu mới chọn tài khoản, Google báo lỗi) */
  googleFailed: 'Chưa đăng nhập được bằng Google. Hãy thử lại.',
  /** Bấm Đăng xuất mà không gửi được yêu cầu (mất mạng) */
  logoutFailed: 'Chưa đăng xuất được. Kiểm tra kết nối mạng rồi thử lại.',
  /** Đổi vai trò thử nghiệm mà không gửi được yêu cầu (mất mạng) */
  roleSwitchFailed: 'Chưa đổi được vai trò. Kiểm tra kết nối mạng rồi thử lại.',
} as const;
