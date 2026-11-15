/* Seed bản thật: tạo Admin đầu tiên và cấu hình email mặc định. Không xóa dữ liệu nào, chạy lại vẫn an toàn.
   Chạy: pnpm --filter api seed:production <email trường của Admin>
   Trong container: docker compose -f docker-compose.prod.yml run --rm api pnpm seed:production <email> */
import { PrismaPg } from '@prisma/adapter-pg';
import { loadDevEnvFile } from '../src/config/env-file';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedProduction } from './production-seed';

// Biến môi trường: .env.dev khi chạy trên máy, compose truyền vào khi chạy container
loadDevEnvFile();

const ADMIN_MESSAGES = {
  created: 'đã tạo, đăng nhập Google bằng email này rồi tự nhập họ tên',
  promoted: 'tài khoản đã có, đã đổi vai trò thành Admin',
  unchanged: 'đã là Admin từ trước, giữ nguyên',
} as const;
const EMAIL_SETTINGS_MESSAGES = { created: 'đã tạo cấu hình mặc định', unchanged: 'đã có, giữ nguyên' } as const;

// Email Admin lấy từ tham số dòng lệnh
const adminEmail = process.argv[2];
if (!adminEmail) {
  console.error('Thiếu email Admin. Cách chạy: pnpm seed:production <email trường>');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const report = await seedProduction(prisma, adminEmail);
  console.log(`Admin ${adminEmail}: ${ADMIN_MESSAGES[report.admin]}.`);
  console.log(`Cấu hình email: ${EMAIL_SETTINGS_MESSAGES[report.emailSettings]}.`);
} finally {
  await prisma.$disconnect();
}
