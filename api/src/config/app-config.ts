/* Biến môi trường của backend: đọc một lần lúc khởi động, kiểm tra bằng Zod. Thiếu hoặc sai thì dừng ngay. */
import { existsSync } from 'node:fs';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

/** Tệp biến môi trường của backend: api/.env (các lệnh pnpm --filter api chạy trong thư mục api/). */
const API_ENV_FILE = '.env';

/** Các biến backend cần. */
const AppEnvSchema = z.object({
  // dev: bật các phần chỉ để thử khi phát triển (đăng nhập theo vai trò, Swagger…) · bỏ trống: bản thật
  APP_ENV: z.enum(['dev', '']).default(''),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  // Thư mục lưu tệp tải lên trên ổ đĩa máy chủ (tương đối với thư mục chạy backend, hoặc đường dẫn tuyệt đối)
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  // Máy chủ gửi thư (SMTP). Có điền: gửi thư thật, kể cả khi APP_ENV=dev · bỏ trống: không gửi (APP_ENV=dev thì in ra console)
  SMTP_HOST: z.string().trim().default(''),
  // 465: kết nối mã hóa ngay (SSL/TLS) · cổng khác (vd 587): nâng lên mã hóa bằng STARTTLS
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  // Tài khoản đăng nhập SMTP, cũng là địa chỉ gửi thư (người nộp đơn bấm "Trả lời" thì thư về đây)
  SMTP_USER: z.email().default('daotao@hcmulaw.edu.vn'),
  // Mật khẩu ứng dụng của tài khoản SMTP
  SMTP_PASSWORD: z.string().default(''),
  // Địa chỉ gốc của cổng (giao diện), để dựng đường dẫn tới đơn trong thư ({link_don}): APP_ENV=dev dùng bản dev, còn lại dùng bản production
  WEB_BASE_URL_DEV: z.url().default('https://localhost:5173'),
  WEB_BASE_URL_PRODUCTION: z.url().default('https://dichvu.hcmulaw.edu.vn'),
  // Chỉ dùng khi APP_ENV=dev: thư tự động gửi về địa chỉ này thay vì người nộp đơn; bỏ trống thì chỉ in ra console
  DEV_EMAIL_REDIRECT_TO: z.union([z.literal(''), z.email()]).default(''),
});

/** Kết nối tới máy chủ gửi thư. */
export interface SmtpConfig {
  /** vd 'smtp.gmail.com'; chuỗi rỗng: chưa cấu hình */
  host: string;
  port: number;
  /** tài khoản đăng nhập, cũng là địa chỉ gửi */
  user: string;
  password: string;
}

/**
 * Nạp api/.env vào process.env, nếu có. Biến đã đặt sẵn (vd trên máy chủ) không bị ghi đè.
 * Gọi trước khi tạo ứng dụng NestJS.
 */
export function loadApiEnvFile(): void {
  if (existsSync(API_ENV_FILE)) process.loadEnvFile(API_ENV_FILE);
}

/** Cấu hình của backend, tiêm vào nơi cần dùng. */
@Injectable()
export class AppConfig {
  /** true khi APP_ENV = "dev": bật các phần JUST FOR DEMO. */
  readonly isDev: boolean;
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

  /**
   * Đọc và kiểm tra biến môi trường.
   * Sai thì báo lỗi kèm tên biến, để ứng dụng không chạy với cấu hình hỏng.
   */
  constructor() {
    const parsed = AppEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
      throw new Error(`Biến môi trường không hợp lệ (xem .env.example): ${problems}`);
    }
    this.isDev = parsed.data.APP_ENV === 'dev';
    this.port = parsed.data.API_PORT;
    this.databaseUrl = parsed.data.DATABASE_URL;
    this.uploadDir = parsed.data.UPLOAD_DIR;
    this.webBaseUrl = this.isDev ? parsed.data.WEB_BASE_URL_DEV : parsed.data.WEB_BASE_URL_PRODUCTION;
    this.devEmailRedirectTo = parsed.data.DEV_EMAIL_REDIRECT_TO || null;
    this.smtp = { host: parsed.data.SMTP_HOST, port: parsed.data.SMTP_PORT, user: parsed.data.SMTP_USER, password: parsed.data.SMTP_PASSWORD };
  }
}
