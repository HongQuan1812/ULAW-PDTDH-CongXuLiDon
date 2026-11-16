/* Dữ liệu ban đầu cho bản thật: Admin đầu tiên, dòng cấu hình email, nơi lưu và lịch sao lưu mặc định. Không xóa, không ghi đè dữ liệu nào đã có,
   nên chạy lại nhiều lần vẫn an toàn. Chạy bằng prisma/seed-production.ts. */
import { randomUUID } from 'node:crypto';
import { BACKUP_SCHEDULE_SEED, BACKUP_TARGETS_SEED, EMAIL_SETTINGS_SEED, isSchoolEmail } from '@ulaw/shared';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client';

/** Dòng cấu hình email duy nhất (cùng id với SETTINGS_ROW_ID của api/src/email/email-settings.service.ts). */
const EMAIL_SETTINGS_ROW_ID = 1;

/** Việc seed bản thật đã làm, để in ra cho người chạy. */
export interface ProductionSeedReport {
  /** Admin: vừa tạo, vừa đổi vai trò từ tài khoản đã có, hay đã là Admin từ trước */
  admin: 'created' | 'promoted' | 'unchanged';
  /** Cấu hình email: vừa tạo, hay đã có từ trước (giữ nguyên) */
  emailSettings: 'created' | 'unchanged';
  /** Sao lưu: vừa tạo nơi lưu và lịch mặc định, hay đã có lịch từ trước (giữ nguyên) */
  backups: 'created' | 'unchanged';
}

/**
 * Tạo Admin đầu tiên, cấu hình email, nơi lưu và lịch sao lưu mặc định nếu chưa có.
 * Có họ tên: Admin mới tạo đã hoàn tất hồ sơ, đăng nhập Google là vào thẳng.
 * Không có họ tên: giống tài khoản tạo ở trang Quản lí tài khoản, lần đầu đăng nhập Google thì tự nhập.
 * @param prisma      Prisma Client
 * @param adminEmail  email trường của Admin đầu tiên
 * @param adminName   họ tên của Admin đầu tiên (FIRST_ADMIN_NAME), bỏ trống thì để người đó tự nhập; chỉ dùng khi tạo mới
 * @returns           việc đã làm với tài khoản Admin, cấu hình email, sao lưu
 * @throws            lỗi nếu email không thuộc tên miền trường (người đó không đăng nhập Google được)
 */
export async function seedProduction(
  prisma: PrismaClient,
  adminEmail: string,
  adminName = '',
): Promise<ProductionSeedReport> {
  // Email viết thường, giống email Google lúc đăng nhập (auth.service tìm tài khoản theo email này)
  const email = adminEmail.trim().toLowerCase();
  if (!isSchoolEmail(email)) throw new Error(`"${adminEmail}" không phải email trường (SCHOOL_EMAIL_DOMAINS), không đăng nhập được`);
  const name = adminName.trim();

  // Admin: chưa có thì tạo (có họ tên thì coi như đã hoàn tất hồ sơ), có rồi thì chỉ đổi vai trò thành Admin, giữ nguyên các thông tin khác
  const existingUser = await prisma.user.findUnique({ where: { email } });
  let admin: ProductionSeedReport['admin'];
  let adminId: string;
  if (!existingUser) {
    adminId = `tk-${randomUUID()}`;
    await prisma.user.create({ data: { id: adminId, email, role: 'admin', name, completed: name !== '' } });
    admin = 'created';
  } else {
    adminId = existingUser.id;
    admin = existingUser.role === 'admin' ? 'unchanged' : 'promoted';
    if (admin === 'promoted') await prisma.user.update({ where: { id: adminId }, data: { role: 'admin' } });
  }

  // Cấu hình email: trang Cấu hình email cần sẵn một dòng; đã có (có thể cán bộ đã sửa) thì giữ nguyên
  const existingSettings = await prisma.emailSettings.findUnique({ where: { id: EMAIL_SETTINGS_ROW_ID } });
  let emailSettings: ProductionSeedReport['emailSettings'] = 'unchanged';
  if (!existingSettings) {
    await prisma.emailSettings.create({
      data: {
        id: EMAIL_SETTINGS_ROW_ID,
        settings: EMAIL_SETTINGS_SEED as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
        updatedById: adminId,
      },
    });
    emailSettings = 'created';
  }

  // Sao lưu: chưa có lịch thì tạo nơi lưu trên máy chủ và lịch 02:00 hằng ngày; đã có (có thể Admin đã sửa, đã tắt) thì giữ nguyên
  const existingSchedule = await prisma.backupSchedule.findUnique({ where: { id: 1 } });
  if (existingSchedule) return { admin, emailSettings, backups: 'unchanged' };
  await prisma.backupTarget.createMany({ data: [...BACKUP_TARGETS_SEED], skipDuplicates: true });
  await prisma.backupSchedule.create({ data: { id: 1, ...BACKUP_SCHEDULE_SEED } });
  return { admin, emailSettings, backups: 'created' };
}
