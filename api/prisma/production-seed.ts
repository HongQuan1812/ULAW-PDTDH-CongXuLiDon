/* Dữ liệu ban đầu cho bản thật: Admin đầu tiên, dòng cấu hình email, loại đơn theo mẫu Word, mẫu xuất đơn, nơi lưu và lịch sao lưu mặc định. Không xóa, không ghi đè dữ liệu nào đã có,
   nên chạy lại nhiều lần vẫn an toàn. Chạy bằng prisma/seed-production.ts. */
import { randomUUID } from 'node:crypto';
import { BACKUP_SCHEDULES_SEED, BACKUP_TARGETS_SEED, EMAIL_SETTINGS_SEED, PRODUCTION_FORM_TYPES_SEED, isSchoolEmail } from '@ulaw/shared';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { loadSeedExportTemplates } from './load-seed-export-templates';

/** Dòng cấu hình email duy nhất (cùng id với SETTINGS_ROW_ID của api/src/email/email-settings.service.ts). */
const EMAIL_SETTINGS_ROW_ID = 1;

/** Việc seed bản thật đã làm, để in ra cho người chạy. */
export interface ProductionSeedReport {
  /** Admin: vừa tạo, vừa đổi vai trò từ tài khoản đã có, hay đã là Admin từ trước */
  admin: 'created' | 'promoted' | 'unchanged';
  /** Cấu hình email: vừa tạo, hay đã có từ trước (giữ nguyên) */
  emailSettings: 'created' | 'unchanged';
  /** Mã các loại đơn vừa thêm (loại đơn đã có, hoặc mã đơn đã bị loại đơn khác dùng, thì bỏ qua) */
  formTypes: string[];
  /** Mã các loại đơn vừa được thêm mẫu xuất đơn (loại đơn không có, hoặc đã có mẫu đơn nào đó, thì bỏ qua) */
  exportTemplates: string[];
  /** Sao lưu: vừa tạo nơi lưu và lịch mặc định, hay đã có lịch từ trước (giữ nguyên) */
  backups: 'created' | 'unchanged';
}

/**
 * Tạo Admin đầu tiên, cấu hình email, loại đơn theo mẫu Word, mẫu xuất đơn, nơi lưu và lịch sao lưu mặc định nếu chưa có.
 * Có họ tên: Admin mới tạo đã hoàn tất hồ sơ, đăng nhập Google là vào thẳng.
 * Không có họ tên: giống tài khoản tạo ở trang Quản lí tài khoản, lần đầu đăng nhập Google thì tự nhập.
 * @param prisma      Prisma Client
 * @param adminEmail  email trường của Admin đầu tiên
 * @param adminName   họ tên của Admin đầu tiên (FIRST_ADMIN_NAME), bỏ trống thì để người đó tự nhập; chỉ dùng khi tạo mới
 * @returns           việc đã làm với tài khoản Admin, cấu hình email, loại đơn, sao lưu
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

  // Loại đơn theo mẫu Word (trừ các mã chưa đưa lên bản thật): chỉ thêm loại đơn chưa có (người lưu là Admin);
  // đã có (có thể Admin đã sửa, đã xóa phiên bản) thì giữ nguyên, mã đơn đã bị loại đơn khác dùng thì bỏ qua để không lỗi trùng mã
  const existingFormTypes = await prisma.formType.findMany({ select: { id: true, prefix: true } });
  const takenIds = new Set(existingFormTypes.map((formType) => formType.id));
  const takenPrefixes = new Set(existingFormTypes.map((formType) => formType.prefix));
  const formTypes: string[] = [];
  for (const formType of PRODUCTION_FORM_TYPES_SEED) {
    if (takenIds.has(formType.id) || takenPrefixes.has(formType.prefix)) continue;
    await prisma.formType.create({
      data: {
        id: formType.id,
        prefix: formType.prefix,
        versions: {
          create: {
            version: 1,
            status: formType.status,
            name: formType.name,
            description: formType.description,
            sections: formType.sections as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(),
            updatedById: adminId,
          },
        },
      },
    });
    formTypes.push(formType.id);
  }

  // Mẫu xuất đơn: loại đơn có trong database mà chưa có mẫu đơn nào thì thêm mẫu theo mẫu Word (người tải lên là Admin);
  // đã có mẫu (có thể cán bộ đã tải mẫu khác, đã sửa) thì giữ nguyên, không ghi đè
  const formTypeIds = new Set((await prisma.formType.findMany({ select: { id: true } })).map((formType) => formType.id));
  const hasFormTemplate = new Set(
    (await prisma.exportTemplate.findMany({ where: { purpose: 'form' }, select: { formTypeId: true } })).map((template) => template.formTypeId),
  );
  const exportTemplates: string[] = [];
  for (const template of loadSeedExportTemplates()) {
    if (!formTypeIds.has(template.formTypeId) || hasFormTemplate.has(template.formTypeId)) continue;
    await prisma.exportTemplate.upsert({
      where: { id: template.id },
      create: { ...template, sizeBytes: template.content.byteLength, uploadedAt: new Date(), uploadedById: adminId },
      update: {},
    });
    exportTemplates.push(template.formTypeId);
  }

  // Sao lưu: chưa có nơi lưu lẫn lịch nào (lần đầu cài) thì tạo nơi lưu trên máy chủ và lịch 02:00 hằng ngày (tắt sẵn, Admin tự bật);
  // đã có (có thể Admin đã sửa, đã tắt, đã bỏ bớt) thì giữ nguyên
  const [targetCount, scheduleCount] = await Promise.all([prisma.backupTarget.count(), prisma.backupSchedule.count()]);
  if (targetCount || scheduleCount) return { admin, emailSettings, formTypes, exportTemplates, backups: 'unchanged' };
  await prisma.backupTarget.createMany({ data: [...BACKUP_TARGETS_SEED], skipDuplicates: true });
  await prisma.backupSchedule.createMany({ data: BACKUP_SCHEDULES_SEED.map((schedule) => ({ ...schedule })), skipDuplicates: true });
  return { admin, emailSettings, formTypes, exportTemplates, backups: 'created' };
}
