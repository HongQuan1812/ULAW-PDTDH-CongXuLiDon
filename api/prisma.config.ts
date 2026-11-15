/* Cấu hình Prisma CLI (migrate, seed, generate). Biến môi trường: .env.dev khi chạy trên máy, compose truyền vào khi chạy container. */
import { defineConfig } from 'prisma/config';
import { loadDevEnvFile } from './src/config/env-file';

loadDevEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
