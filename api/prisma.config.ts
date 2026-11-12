/* Cấu hình Prisma CLI (migrate, seed, generate). Biến môi trường đọc từ api/.env. */
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Khi phát triển biến nằm trong api/.env; trên máy chủ thì biến đặt sẵn, không có tệp
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
