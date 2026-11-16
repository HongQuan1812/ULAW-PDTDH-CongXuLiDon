/* Biến môi trường của backend: đọc một lần lúc khởi động, kiểm tra bằng Zod. Thiếu hoặc sai thì dừng ngay. */
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DEMO_APIS, usesDemoApi, type DemoApi } from './demo-apis';

/**
 * Biến chứa một địa chỉ URL, không có hoặc để trống (vd `WEB_BASE_URL_PRODUCTION=`) thì dùng giá trị mặc định.
 * @param fallbackUrl  địa chỉ dùng khi bỏ trống, vd 'https://localhost'
 * @returns            schema Zod trả về địa chỉ đã kiểm tra
 */
function urlOrDefault(fallbackUrl: string) {
  return z
    .union([z.literal(''), z.url()])
    .default('')
    .transform((configuredUrl) => configuredUrl || fallbackUrl);
}

/** Các biến backend cần. */
const AppEnvSchema = z.object({
  // Môi trường: dev (Swagger, thư in ra console, WEB_BASE_URL_DEV, cookie không secure) · bỏ trống: bản thật
  APP_ENV: z.enum(['dev', '']).default(''),
  // Bản giả của API (không liên quan APP_ENV): true: API nào có bản giả thì dùng bản giả (đăng nhập thử theo vai trò, dev-login),
  // trừ các API trong ALWAYS_REAL_APIS · false / bỏ trống: dùng bản thật (đăng nhập Google)
  ENABLE_DEMO_APIS: z.enum(['true', 'false', '']).default(''),
  // Khi bật bản giả: các API vẫn dùng bản thật, cách nhau bằng dấu phẩy, vd dev-login · tên phải có trong DEMO_APIS (config/demo-apis.ts)
  ALWAYS_REAL_APIS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((name) => name.trim()).filter(Boolean))
    .pipe(z.array(z.enum(DEMO_APIS, `chỉ nhận tên trong DEMO_APIS: ${DEMO_APIS.join(', ')}`))),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  // Thư mục lưu tệp tải lên trên ổ đĩa máy chủ (tương đối với thư mục chạy backend, hoặc đường dẫn tuyệt đối)
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  // Máy chủ gửi thư (SMTP). Có điền: gửi thư thật, kể cả khi APP_ENV=dev · bỏ trống: không gửi (APP_ENV=dev thì in ra console)
  SMTP_HOST: z.string().trim().default(''),
  // 465: kết nối mã hóa ngay (SSL/TLS) · cổng khác (vd 587): nâng lên mã hóa bằng STARTTLS
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  // Tài khoản đăng nhập SMTP, cũng là địa chỉ gửi thư (người nộp đơn bấm "Trả lời" thì thư về đây)
  SMTP_USER: z.email().default('lhquan@hcmulaw.edu.vn'),
  // Mật khẩu ứng dụng của tài khoản SMTP
  SMTP_PASSWORD: z.string().default(''),
  // Địa chỉ gốc của cổng (giao diện), để dựng đường dẫn tới đơn trong thư ({link_don}) và redirect URI của Google:
  // APP_ENV=dev dùng bản dev, còn lại dùng bản production · bỏ trống: chạy trên máy mình (localhost)
  WEB_BASE_URL_DEV: urlOrDefault('https://localhost:5173'),
  WEB_BASE_URL_PRODUCTION: urlOrDefault('https://localhost'),
  // Chỉ dùng khi APP_ENV=dev: thư tự động gửi về địa chỉ này thay vì người nộp đơn; bỏ trống thì chỉ in ra console
  DEV_EMAIL_REDIRECT_TO: z.union([z.literal(''), z.email()]).default(''),
  // OAuth client (loại Web application) tạo ở Google Cloud Console; bỏ trống: chưa bật đăng nhập Google (ENABLE_DEMO_APIS=true vẫn đăng nhập thử được)
  GOOGLE_CLIENT_ID: z.string().trim().default(''),
  GOOGLE_CLIENT_SECRET: z.string().trim().default(''),
  // Database trường (SQL Server, chỉ đọc), cho student-directory bản thật; tên database, bảng, cột lấy từ student-directory/school-database.json
  // · SCHOOL_DB_HOST bỏ trống: chưa kết nối (bản thật trả 503)
  SCHOOL_DB_HOST: z.string().trim().default(''),
  SCHOOL_DB_PORT: z.coerce.number().int().min(1).max(65535).default(1433),
  SCHOOL_DB_USER: z.string().trim().default(''),
  SCHOOL_DB_PASSWORD: z.string().default(''),
});

/** OAuth client của Google. */
export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Địa chỉ Google chuyển về sau khi chọn tài khoản; phải khai báo y hệt ở mục Authorized redirect URIs của OAuth client */
  redirectUri: string;
}

/** Đường dẫn (sau địa chỉ gốc của cổng) Google chuyển về; web server / Vite chuyển /api sang backend. */
const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';

/** Kết nối tới máy chủ gửi thư. */
export interface SmtpConfig {
  /** vd 'smtp.gmail.com'; chuỗi rỗng: chưa cấu hình */
  host: string;
  port: number;
  /** tài khoản đăng nhập, cũng là địa chỉ gửi */
  user: string;
  password: string;
}

/** Kết nối tới database trường (SQL Server). Tên database không ở đây: lấy từ school-database.json. */
export interface SchoolDatabaseConfig {
  /** vd '192.168.3.25' */
  host: string;
  port: number;
  user: string;
  password: string;
}

/** Cấu hình của backend, tiêm vào nơi cần dùng. */
@Injectable()
export class AppConfig {
  /** true khi APP_ENV = "dev": môi trường phát triển (Swagger, thư in ra console, WEB_BASE_URL_DEV, cookie không secure). */
  readonly isDev: boolean;
  /** true khi ENABLE_DEMO_APIS = "true": API nào có bản giả thì dùng bản giả, trừ ALWAYS_REAL_APIS. Hỏi từng API bằng usesDemoApi(). */
  readonly demoApisEnabled: boolean;
  /** ALWAYS_REAL_APIS: các API luôn dùng bản thật, kể cả khi bật bản giả. */
  readonly alwaysRealApis: ReadonlySet<DemoApi>;
  /** Cổng backend nghe, vd 3000. */
  readonly port: number;
  /** Chuỗi kết nối PostgreSQL bằng user của dự án. */
  readonly databaseUrl: string;
  /** Thư mục lưu tệp tải lên, vd 'uploads'. */
  readonly uploadDir: string;
  /** Máy chủ gửi thư. */
  readonly smtp: SmtpConfig;
  /** Địa chỉ gốc của cổng theo môi trường: dev thì WEB_BASE_URL_DEV, còn lại WEB_BASE_URL_PRODUCTION. */
  readonly webBaseUrl: string;
  /** Chỉ dùng khi APP_ENV=dev: địa chỉ nhận thay mọi thư tự động; null thì thư tự động chỉ in ra console. */
  readonly devEmailRedirectTo: string | null;
  /** Đăng nhập Google; null khi chưa điền GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET. */
  readonly google: GoogleOAuthConfig | null;
  /** Database trường; null khi chưa điền SCHOOL_DB_HOST. */
  readonly schoolDatabase: SchoolDatabaseConfig | null;

  /**
   * Đọc và kiểm tra biến môi trường.
   * Sai thì báo lỗi kèm tên biến, để ứng dụng không chạy với cấu hình hỏng.
   */
  constructor() {
    const parsed = AppEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
      throw new Error(`Biến môi trường không hợp lệ (xem .env.dev.example, .env.prod.example): ${problems}`);
    }
    this.isDev = parsed.data.APP_ENV === 'dev';
    this.demoApisEnabled = parsed.data.ENABLE_DEMO_APIS === 'true';
    this.alwaysRealApis = new Set(parsed.data.ALWAYS_REAL_APIS);
    this.port = parsed.data.API_PORT;
    this.databaseUrl = parsed.data.DATABASE_URL;
    this.uploadDir = parsed.data.UPLOAD_DIR;
    this.webBaseUrl = this.isDev ? parsed.data.WEB_BASE_URL_DEV : parsed.data.WEB_BASE_URL_PRODUCTION;
    this.devEmailRedirectTo = parsed.data.DEV_EMAIL_REDIRECT_TO || null;
    this.google =
      parsed.data.GOOGLE_CLIENT_ID && parsed.data.GOOGLE_CLIENT_SECRET
        ? {
            clientId: parsed.data.GOOGLE_CLIENT_ID,
            clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
            redirectUri: new URL(GOOGLE_CALLBACK_PATH, this.webBaseUrl).toString(),
          }
        : null;
    this.smtp = { host: parsed.data.SMTP_HOST, port: parsed.data.SMTP_PORT, user: parsed.data.SMTP_USER, password: parsed.data.SMTP_PASSWORD };
    this.schoolDatabase = parsed.data.SCHOOL_DB_HOST
      ? {
          host: parsed.data.SCHOOL_DB_HOST,
          port: parsed.data.SCHOOL_DB_PORT,
          user: parsed.data.SCHOOL_DB_USER,
          password: parsed.data.SCHOOL_DB_PASSWORD,
        }
      : null;
  }

  /**
   * Một API dùng bản giả hay bản thật.
   * @param api  tên API giả trong DEMO_APIS, vd 'dev-login'
   * @returns    true: bản giả (ENABLE_DEMO_APIS=true và API không nằm trong ALWAYS_REAL_APIS) · false: bản thật
   */
  usesDemoApi(api: DemoApi): boolean {
    return usesDemoApi(this.demoApisEnabled, api, this.alwaysRealApis);
  }
}
