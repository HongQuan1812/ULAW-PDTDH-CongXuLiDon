/* HỢP ĐỒNG nhóm API Nguồn dữ liệu (chỉ vai trò có quyền manageDataSources): các nguồn dữ liệu bên ngoài cổng đọc tới,
   cấu hình kết nối (không bao giờ có mật khẩu) và đang kết nối được không. Trước mắt có database trường (thông tin sinh viên).
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const DATA_SOURCE_ENDPOINTS = {
  /** GET → DataSourcesResponse: máy chủ thử kết nối từng nguồn ngay lúc gọi */
  list: '/data-sources',
} as const;

/* ---------- Dữ liệu nhận ---------- */

/** Vì sao chưa kết nối được database trường. */
export const SCHOOL_DATABASE_PROBLEMS = [
  'notConfigured', // chưa điền SCHOOL_DB_HOST
  'unreachable', //   không tới được máy chủ (sai địa chỉ, tường lửa, hết thời gian chờ)
  'loginFailed', //   tới được nhưng sai tài khoản / mật khẩu, hoặc tài khoản không được vào database
  'error', //         lỗi khác
] as const;
export type SchoolDatabaseProblem = (typeof SCHOOL_DATABASE_PROBLEMS)[number];

/** Database trường (SQL Server, chỉ đọc): cấu hình đang dùng và kết quả thử kết nối. */
export const SchoolDatabaseStatusSchema = z.object({
  /** địa chỉ máy chủ, vd '192.168.3.25'; null khi chưa cấu hình */
  host: z.string().nullable(),
  port: z.number().int(),
  /** tên database, vd 'CoreUis' */
  database: z.string(),
  /** tài khoản đăng nhập; null khi chưa cấu hình */
  user: z.string().nullable(),
  connected: z.boolean(),
  /** thời gian thử kết nối và chạy một câu truy vấn, mili giây; null khi chưa kết nối được */
  latencyMs: z.number().int().nullable(),
  /** vì sao chưa kết nối được; null khi đã kết nối */
  problem: z.enum(SCHOOL_DATABASE_PROBLEMS).nullable(),
  /** trang hồ sơ đang lấy thông tin sinh viên từ đâu: true = bảng mẫu (bản giả dev-student-directory), false = database trường */
  usesSampleData: z.boolean(),
  /** lúc thử kết nối, giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
  checkedAt: z.string(),
});
export type SchoolDatabaseStatus = z.infer<typeof SchoolDatabaseStatusSchema>;

/** Trả về từ GET /data-sources. */
export const DataSourcesResponseSchema = z.object({
  schoolDatabase: SchoolDatabaseStatusSchema,
});
export type DataSourcesResponse = z.infer<typeof DataSourcesResponseSchema>;

/* ---------- Câu thông báo ---------- */

export const DATA_SOURCE_MESSAGES = {
  401: 'Bạn chưa đăng nhập.',
  /** Mọi API của nhóm khi không có quyền manageDataSources */
  403: 'Bạn không có quyền xem nguồn dữ liệu.',
  /** Câu giải thích từng lí do chưa kết nối được database trường */
  schoolDatabaseProblem: {
    notConfigured: 'Chưa cấu hình: máy chủ chưa có địa chỉ database trường (SCHOOL_DB_HOST).',
    unreachable: 'Không tới được máy chủ database trường: kiểm tra địa chỉ, cổng, tường lửa, mạng LAN.',
    loginFailed: 'Tới được máy chủ nhưng không đăng nhập được: kiểm tra tài khoản, mật khẩu, quyền vào database.',
    error: 'Database trường báo lỗi khi thử truy vấn. Xem log của backend.',
  } satisfies Record<SchoolDatabaseProblem, string>,
} as const;
