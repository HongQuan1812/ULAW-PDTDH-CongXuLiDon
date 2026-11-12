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
});

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
  }
}
