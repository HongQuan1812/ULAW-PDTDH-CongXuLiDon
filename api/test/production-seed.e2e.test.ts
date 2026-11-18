/* Test seed bản thật (prisma/production-seed.ts). Cần database đã migrate và seed dữ liệu mẫu.
   Test tạo tài khoản thử rồi xóa, trả cb-2 và dòng cấu hình email về như seed. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PRODUCTION_FORM_TYPES_SEED } from '@ulaw/shared';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedProduction } from '../prisma/production-seed';

const NEW_ADMIN_EMAIL = 'admin.dau.tien@hcmulaw.edu.vn';

describe('seedProduction', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    await prisma.user.deleteMany({ where: { email: NEW_ADMIN_EMAIL } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: NEW_ADMIN_EMAIL } });
    await prisma.user.update({ where: { id: 'cb-2' }, data: { role: 'nguoiXuLiDon' } });
    await prisma.$disconnect();
  });

  it('tạo Admin mới (họ tên trống, chưa bổ sung) và giữ nguyên cấu hình email đã có', async () => {
    const settingsBefore = await prisma.emailSettings.findUniqueOrThrow({ where: { id: 1 } });
    const userCountBefore = await prisma.user.count();

    const report = await seedProduction(prisma, '  Admin.Dau.Tien@HCMULAW.edu.vn ');

    expect(report).toEqual({ admin: 'created', emailSettings: 'unchanged', formTypes: [], exportTemplates: [], backups: 'unchanged' });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: NEW_ADMIN_EMAIL } });
    expect(admin).toMatchObject({ role: 'admin', name: '', completed: false });
    expect(admin.id).toMatch(/^tk-/);
    expect(await prisma.user.count()).toBe(userCountBefore + 1);
    expect(await prisma.emailSettings.findUniqueOrThrow({ where: { id: 1 } })).toEqual(settingsBefore);
  });

  it('chạy lại không tạo thêm, không đổi gì, kể cả khi có họ tên', async () => {
    const userCountBefore = await prisma.user.count();
    const before = await prisma.user.findUniqueOrThrow({ where: { email: NEW_ADMIN_EMAIL } });

    const report = await seedProduction(prisma, NEW_ADMIN_EMAIL, 'Nguyễn Văn A');

    expect(report).toEqual({ admin: 'unchanged', emailSettings: 'unchanged', formTypes: [], exportTemplates: [], backups: 'unchanged' });
    expect(await prisma.user.count()).toBe(userCountBefore);
    expect(await prisma.user.findUniqueOrThrow({ where: { email: NEW_ADMIN_EMAIL } })).toEqual(before);
  });

  it('có họ tên: tạo Admin đã hoàn tất hồ sơ, đăng nhập là vào thẳng', async () => {
    await prisma.user.deleteMany({ where: { email: NEW_ADMIN_EMAIL } });

    const report = await seedProduction(prisma, NEW_ADMIN_EMAIL, '  Nguyễn Văn A ');

    expect(report.admin).toBe('created');
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: NEW_ADMIN_EMAIL } });
    expect(admin).toMatchObject({ role: 'admin', name: 'Nguyễn Văn A', completed: true });
  });

  it('tài khoản đã có thì chỉ đổi vai trò thành Admin, giữ thông tin khác', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: 'cb-2' } });

    const report = await seedProduction(prisma, before.email);

    expect(report.admin).toBe('promoted');
    const after = await prisma.user.findUniqueOrThrow({ where: { id: 'cb-2' } });
    expect(after).toEqual({ ...before, role: 'admin' });
  });

  it('tạo cấu hình email mặc định khi chưa có, người lưu là Admin', async () => {
    const settingsBefore = await prisma.emailSettings.findUniqueOrThrow({ where: { id: 1 } });
    await prisma.emailSettings.delete({ where: { id: 1 } });
    try {
      const report = await seedProduction(prisma, NEW_ADMIN_EMAIL);

      expect(report.emailSettings).toBe('created');
      const admin = await prisma.user.findUniqueOrThrow({ where: { email: NEW_ADMIN_EMAIL } });
      const created = await prisma.emailSettings.findUniqueOrThrow({ where: { id: 1 } });
      expect(created.updatedById).toBe(admin.id);
      expect(created.settings).toEqual(settingsBefore.settings);
    } finally {
      // Trả về dòng của seed mẫu (người lưu cb-1), để afterAll xóa được Admin thử
      await prisma.emailSettings.upsert({ where: { id: 1 }, create: settingsBefore as never, update: settingsBefore as never });
    }
  });

  it('thêm loại đơn theo mẫu Word còn thiếu (người lưu là Admin); đã có hoặc trùng mã đơn thì giữ nguyên', async () => {
    const [first] = PRODUCTION_FORM_TYPES_SEED;
    const rollback = new Error('rollback');

    // Chạy trong một transaction rồi hủy: xóa loại đơn (kèm các đơn mẫu của nó) mà dữ liệu mẫu vẫn nguyên sau test
    const result = prisma.$transaction(async (tx) => {
      const txPrisma = tx as unknown as PrismaClient;
      await tx.form.deleteMany({ where: { formTypeId: first!.id } });
      await tx.formType.delete({ where: { id: first!.id } });
      const report = await seedProduction(txPrisma, NEW_ADMIN_EMAIL);

      expect(report.formTypes).toEqual([first!.id]);
      const admin = await tx.user.findUniqueOrThrow({ where: { email: NEW_ADMIN_EMAIL } });
      const created = await tx.formTypeVersion.findUniqueOrThrow({ where: { formTypeId_version: { formTypeId: first!.id, version: 1 } } });
      expect(created).toMatchObject({ status: first!.status, name: first!.name, sections: first!.sections, updatedById: admin.id });
      expect((await seedProduction(txPrisma, NEW_ADMIN_EMAIL)).formTypes).toEqual([]);

      // Mã đơn đã bị loại đơn khác dùng: bỏ qua
      await tx.formType.delete({ where: { id: first!.id } });
      await tx.formType.update({ where: { id: 'xmr' }, data: { prefix: first!.prefix } });
      expect((await seedProduction(txPrisma, NEW_ADMIN_EMAIL)).formTypes).toEqual([]);
      throw rollback;
    });
    await expect(result).rejects.toBe(rollback);
    expect(await prisma.form.count({ where: { formTypeId: first!.id } })).toBeGreaterThan(0);
  });

  it('thêm mẫu xuất file đơn cho loại đơn chưa có mẫu đơn nào (người tải lên là Admin); đã có mẫu thì giữ nguyên', async () => {
    const formTypeId = PRODUCTION_FORM_TYPES_SEED[0]!.id;
    const rollback = new Error('rollback');

    // Chạy trong một transaction rồi hủy, để mẫu của dữ liệu mẫu vẫn nguyên sau test
    const result = prisma.$transaction(async (tx) => {
      const txPrisma = tx as unknown as PrismaClient;
      await tx.exportTemplate.deleteMany({ where: { formTypeId } });
      const report = await seedProduction(txPrisma, NEW_ADMIN_EMAIL);

      expect(report.exportTemplates).toEqual([formTypeId]);
      const admin = await tx.user.findUniqueOrThrow({ where: { email: NEW_ADMIN_EMAIL } });
      const created = await tx.exportTemplate.findUniqueOrThrow({ where: { id: `tpl-${formTypeId}` } });
      expect(created).toMatchObject({ formTypeId, purpose: 'form', fileName: `mau-don-${formTypeId}.docx`, uploadedById: admin.id });
      expect(created.sizeBytes).toBe(created.content.byteLength);
      expect((await seedProduction(txPrisma, NEW_ADMIN_EMAIL)).exportTemplates).toEqual([]);

      // Cán bộ đã thay bằng mẫu khác (xóa mẫu seed, tải mẫu riêng): giữ nguyên, không thêm lại
      await tx.exportTemplate.update({ where: { id: `tpl-${formTypeId}` }, data: { id: 'tpl-can-bo-tai-len', name: 'Mẫu riêng' } });
      expect((await seedProduction(txPrisma, NEW_ADMIN_EMAIL)).exportTemplates).toEqual([]);
      throw rollback;
    });
    await expect(result).rejects.toBe(rollback);
    expect(await prisma.exportTemplate.count({ where: { id: `tpl-${formTypeId}` } })).toBe(1);
  });

  it('chưa có nơi lưu lẫn lịch sao lưu nào thì tạo nơi lưu trên máy chủ và lịch 02:00 hằng ngày (tắt sẵn); đã có thì giữ nguyên', async () => {
    const [targetsBefore, schedulesBefore] = await Promise.all([prisma.backupTarget.findMany(), prisma.backupSchedule.findMany()]);
    await prisma.backupSchedule.deleteMany();
    await prisma.backupTarget.deleteMany();
    try {
      const report = await seedProduction(prisma, NEW_ADMIN_EMAIL);

      expect(report.backups).toBe('created');
      expect(await prisma.backupSchedule.findMany()).toMatchObject([{ enabled: false, time: '02:00', targetIds: ['backup-target-server'] }]);
      expect(await prisma.backupTarget.count({ where: { id: 'backup-target-server' } })).toBe(1);
      expect((await seedProduction(prisma, NEW_ADMIN_EMAIL)).backups).toBe('unchanged');
    } finally {
      await prisma.backupSchedule.deleteMany();
      await prisma.backupTarget.deleteMany();
      await prisma.backupTarget.createMany({ data: targetsBefore });
      await prisma.backupSchedule.createMany({ data: schedulesBefore });
    }
  });

  it('từ chối email ngoài trường, không ghi gì', async () => {
    const userCountBefore = await prisma.user.count();

    await expect(seedProduction(prisma, 'ai.do@gmail.com')).rejects.toThrow('không phải email trường');
    expect(await prisma.user.count()).toBe(userCountBefore);
  });
});
