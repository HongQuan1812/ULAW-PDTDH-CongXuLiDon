/* Test seed bản thật (prisma/production-seed.ts). Cần database đã migrate và seed dữ liệu mẫu.
   Test tạo tài khoản thử rồi xóa, trả cb-2 và dòng cấu hình email về như seed. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
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

    expect(report).toEqual({ admin: 'created', emailSettings: 'unchanged' });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: NEW_ADMIN_EMAIL } });
    expect(admin).toMatchObject({ role: 'admin', name: '', completed: false });
    expect(admin.id).toMatch(/^tk-/);
    expect(await prisma.user.count()).toBe(userCountBefore + 1);
    expect(await prisma.emailSettings.findUniqueOrThrow({ where: { id: 1 } })).toEqual(settingsBefore);
  });

  it('chạy lại không tạo thêm, không đổi gì', async () => {
    const userCountBefore = await prisma.user.count();

    const report = await seedProduction(prisma, NEW_ADMIN_EMAIL);

    expect(report).toEqual({ admin: 'unchanged', emailSettings: 'unchanged' });
    expect(await prisma.user.count()).toBe(userCountBefore);
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

  it('từ chối email ngoài trường, không ghi gì', async () => {
    const userCountBefore = await prisma.user.count();

    await expect(seedProduction(prisma, 'ai.do@gmail.com')).rejects.toThrow('không phải email trường');
    expect(await prisma.user.count()).toBe(userCountBefore);
  });
});
