/* Đọc tệp biến môi trường khi chạy thẳng trên máy (không container). Không phụ thuộc NestJS,
   nên prisma.config.ts, seed và test dùng chung được. */
import { existsSync } from 'node:fs';

/** Tệp biến môi trường dev ở thư mục gốc repo (các lệnh pnpm --filter api chạy trong thư mục api/). */
const DEV_ENV_FILE = '../.env.dev';

/**
 * Nạp .env.dev ở thư mục gốc vào process.env, nếu có.
 * Biến đã đặt sẵn (vd compose truyền vào container) không bị ghi đè, nên trong container giá trị của compose được dùng.
 * Gọi trước khi đọc cấu hình.
 */
export function loadDevEnvFile(): void {
  if (existsSync(DEV_ENV_FILE)) process.loadEnvFile(DEV_ENV_FILE);
}
