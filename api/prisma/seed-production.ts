/* Seed bản thật: tạo Admin đầu tiên, cấu hình email mặc định, loại đơn theo mẫu Word, mẫu xuất đơn. Không xóa dữ liệu nào, chạy lại vẫn an toàn.
   Container bản thật tự chạy mỗi lần bật / restart (api/Dockerfile), email lấy từ FIRST_ADMIN_EMAIL trong .env.prod,
   họ tên từ FIRST_ADMIN_NAME (có thì Admin đăng nhập là vào thẳng, trống thì lần đầu tự nhập).
   Chạy tay: pnpm --filter api seed:production [email trường của Admin], bỏ trống thì lấy FIRST_ADMIN_EMAIL */
import { createDatabaseAdapter } from '../src/common/database-adapter';
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
const BACKUP_MESSAGES = { created: 'đã tạo nơi lưu trên máy chủ và lịch 02:00 hằng ngày (đang tắt)', unchanged: 'đã có lịch, giữ nguyên' } as const;

// Email Admin: tham số dòng lệnh, không có thì lấy FIRST_ADMIN_EMAIL
const adminEmail = process.argv[2] || process.env.FIRST_ADMIN_EMAIL?.trim();
if (!adminEmail) {
  console.error('Thiếu email Admin. Đặt FIRST_ADMIN_EMAIL trong .env.prod, hoặc chạy: pnpm seed:production <email trường>');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: createDatabaseAdapter(process.env.DATABASE_URL) });
try {
  const report = await seedProduction(prisma, adminEmail, process.env.FIRST_ADMIN_NAME ?? '');
  console.log(`Admin ${adminEmail}: ${ADMIN_MESSAGES[report.admin]}.`);
  console.log(`Cấu hình email: ${EMAIL_SETTINGS_MESSAGES[report.emailSettings]}.`);
  console.log(`Loại đơn: ${report.formTypes.length ? `đã thêm ${report.formTypes.join(', ')}` : 'đã có đủ, giữ nguyên'}.`);
  console.log(`Mẫu xuất đơn: ${report.exportTemplates.length ? `đã thêm cho ${report.exportTemplates.join(', ')}` : 'loại đơn nào cũng đã có mẫu, giữ nguyên'}.`);
  console.log(`Sao lưu: ${BACKUP_MESSAGES[report.backups]}.`);
} finally {
  await prisma.$disconnect();
}
