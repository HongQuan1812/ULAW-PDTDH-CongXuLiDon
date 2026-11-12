/* Test nhóm API forms (các bảng danh sách đơn, thống kê, CCCD). Đọc dữ liệu mẫu đã seed; chỉ tạm đặt CCCD cho một người nộp đơn
   (dữ liệu mẫu chưa có) và trả lại như cũ khi xong. Cần database đã migrate và seed. */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ApiErrorBodySchema,
  COMMON_MESSAGES,
  FORMS_MESSAGES,
  FormCccdsResponseSchema,
  FormStatsSchema,
  HandledFormsResponseSchema,
  ManagedFormsResponseSchema,
  MyFormsResponseSchema,
  type RoleId,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

const TEST_CCCD = '079199009988';

describe('forms (danh sách đơn)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerWithCccd: { id: string; cccd: string };
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/dev-login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // Dữ liệu mẫu chưa có người nộp đơn nào có CCCD: tạm đặt cho một người
    const owner = await prisma.user.findFirstOrThrow({ where: { cccd: null, forms: { some: {} } } });
    await prisma.user.update({ where: { id: owner.id }, data: { cccd: TEST_CCCD } });
    ownerWithCccd = { id: owner.id, cccd: TEST_CCCD };
  });

  afterAll(async () => {
    await prisma.user.update({ where: { id: ownerWithCccd.id }, data: { cccd: null } });
    await app.close();
  });

  it('chưa đăng nhập: 401', async () => {
    for (const path of ['/api/forms', '/api/forms/mine', '/api/forms/handled', '/api/forms/stats', '/api/forms/cccds?userIds=a']) {
      const response = await request(server()).get(path).expect(401);
      expect(ApiErrorBodySchema.parse(response.body).message).toBe(FORMS_MESSAGES[401]);
    }
  });

  it('người nộp đơn: xem được đơn của mình, 403 ở các bảng của cán bộ', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const me = (await request(server()).get('/api/auth/me').set('Cookie', cookie).expect(200)).body.user.id as string;
    const mine = MyFormsResponseSchema.parse((await request(server()).get('/api/forms/mine').set('Cookie', cookie).expect(200)).body);
    expect(mine.total).toBe(await prisma.form.count({ where: { ownerId: me } }));
    expect(mine.total).toBeGreaterThan(0);

    const expectedMessages: [string, string][] = [
      ['/api/forms', FORMS_MESSAGES.listForbidden],
      ['/api/forms/handled', FORMS_MESSAGES.handledForbidden],
      ['/api/forms/stats', FORMS_MESSAGES.statsForbidden],
      ['/api/forms/cccds?userIds=a', FORMS_MESSAGES.cccdsForbidden],
    ];
    for (const [path, message] of expectedMessages) {
      const response = await request(server()).get(path).set('Cookie', cookie).expect(403);
      expect(ApiErrorBodySchema.parse(response.body).message).toBe(message);
    }
  });

  it('GET /forms: mọi đơn, mới nộp lên trên, CCCD người nộp che, chia trang đúng', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const totalInDb = await prisma.form.count();
    const all = ManagedFormsResponseSchema.parse((await request(server()).get('/api/forms').query({ pageSize: 100 }).set('Cookie', cookie).expect(200)).body);
    expect(all.total).toBe(totalInDb);
    const times = all.forms.map((form) => form.submittedAt);
    expect(times).toEqual([...times].sort().reverse());
    const fullCccds = (await prisma.user.findMany({ where: { cccd: { not: null } }, select: { cccd: true } })).map((user) => user.cccd!);
    for (const cccd of fullCccds) expect(JSON.stringify(all)).not.toContain(cccd);

    const secondPage = ManagedFormsResponseSchema.parse((await request(server()).get('/api/forms').query({ page: 2, pageSize: 5 }).set('Cookie', cookie).expect(200)).body);
    expect(secondPage.page).toBe(2);
    expect(secondPage.forms.map((form) => form.code)).toEqual(all.forms.slice(5, 10).map((form) => form.code));
  });

  it('GET /forms: tìm theo số CCCD đầy đủ được, dù ô CCCD vẫn che', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const owner = ownerWithCccd;
    const page = ManagedFormsResponseSchema.parse((await request(server()).get('/api/forms').query({ search: owner.cccd, pageSize: 100 }).set('Cookie', cookie).expect(200)).body);
    expect(page.total).toBe(await prisma.form.count({ where: { ownerId: owner.id } }));
    expect(page.forms.every((form) => form.applicant.id === owner.id)).toBe(true);
    expect(page.forms[0]?.applicant.maskedCccd).not.toBe(owner.cccd);
  });

  it('tham số trang sai: 422', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    for (const path of ['/api/forms?page=abc', '/api/forms/mine?pageSize=0', '/api/forms/handled?page=-1']) {
      const response = await request(server()).get(path).set('Cookie', cookie).expect(422);
      expect(ApiErrorBodySchema.parse(response.body).message).toBe(COMMON_MESSAGES.listQuery);
    }
  });

  it('GET /forms/stats: tổng, theo trạng thái và theo loại đơn khớp database', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const stats = FormStatsSchema.parse((await request(server()).get('/api/forms/stats').set('Cookie', cookie).expect(200)).body);
    expect(stats.total).toBe(await prisma.form.count());
    expect(Object.values(stats.byStatus).reduce((sum, count) => sum + count, 0)).toBe(stats.total);
    expect(stats.byType.reduce((sum, row) => sum + row.count, 0)).toBe(stats.total);
    const counts = stats.byType.map((row) => row.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(stats.byType.find((row) => row.formTypeId === 'xmm')?.formTypeName).toBeTruthy();
    expect(stats.byType.length).toBe(await prisma.formType.count());
  });

  it('GET /forms/handled: chỉ đơn mình tiếp nhận hoặc xử lí', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const me = (await request(server()).get('/api/auth/me').set('Cookie', cookie).expect(200)).body.user.id as string;
    const page = HandledFormsResponseSchema.parse((await request(server()).get('/api/forms/handled').query({ pageSize: 100 }).set('Cookie', cookie).expect(200)).body);
    expect(page.total).toBe(await prisma.form.count({ where: { OR: [{ receiverId: me }, { handlerId: me }] } }));
    expect(page.forms.every((form) => form.receiver?.id === me || form.handler?.id === me)).toBe(true);
  });

  it('GET /forms/cccds: trả CCCD đầy đủ của người nộp đã hỏi, 422 khi thiếu danh sách', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const withCccd = ownerWithCccd;
    // Người có CCCD nhưng chưa nộp đơn nào (tài khoản cán bộ) không có mặt trong kết quả
    const withoutForms = await prisma.user.findFirstOrThrow({ where: { cccd: { not: null }, forms: { none: {} } } });

    const response = await request(server()).get('/api/forms/cccds').query({ userIds: `${withCccd.id},${withoutForms.id}` }).set('Cookie', cookie).expect(200);
    expect(FormCccdsResponseSchema.parse(response.body).cccds).toEqual({ [withCccd.id]: withCccd.cccd });

    const bad = await request(server()).get('/api/forms/cccds').set('Cookie', cookie).expect(422);
    expect(ApiErrorBodySchema.parse(bad.body).message).toBe(COMMON_MESSAGES.userIds);
  });
});
