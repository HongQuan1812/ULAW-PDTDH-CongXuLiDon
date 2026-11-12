/* Cấu hình Vitest cho backend: test đơn vị trong src/, test e2e (Supertest) trong test/. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // Các test e2e dùng chung một database và sửa cùng dữ liệu mẫu, nên chạy lần lượt từng tệp
    fileParallelism: false,
    // Nạp api/.env trước mỗi tệp test, như lúc chạy thật
    setupFiles: ['test/setup-env.ts'],
  },
});
