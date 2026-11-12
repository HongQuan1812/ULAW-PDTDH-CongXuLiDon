/* Test nhóm API accounts. Cần database đã migrate và seed. Test tạo, sửa tài khoản rồi xóa những tài khoản đã tạo và trả cb-2 về như seed. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ACCOUNT_MESSAGES,
  AccountCccdsResponseSchema,
  AccountSchema,
  AccountsResponseSchema,
  ApiErrorBodySchema,
  COMMON_MESSAGES,
  type RoleId,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

const TEST_EMAIL = 'tai.khoan.thu@hcmulaw.edu.vn';

describe('accounts', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/dev-login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.user.update({ where: { id: 'cb-2' }, data: { name: 'Trần Quốc Việt', phone: null, cccd: null, role: 'nguoiXuLiDon' } });
    await app.close();
  });

  it('chưa đăng nhập: 401', async () => {
    const response = await request(server()).get('/api/accounts').expect(401);
    expect(ApiErrorBodySchema.parse(response.body).message).toBe(ACCOUNT_MESSAGES[401]);
  });

  it('thiếu quyền manageAccounts: 403 ở danh sách, tạo, CCCD, sửa', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    for (const call of [
      request(server()).get('/api/accounts').set('Cookie', cookie),
      request(server()).get('/api/accounts/cccds?userIds=sv-1').set('Cookie', cookie),
      request(server()).post('/api/accounts').set('Cookie', cookie).send({}),
      request(server()).put('/api/accounts/sv-2').set('Cookie', cookie).send({}),
    ]) {
      const response = await call.expect(403);
      expect(ApiErrorBodySchema.parse(response.body).message).toBe(ACCOUNT_MESSAGES[403]);
    }
  });

  it('GET /accounts trả một trang, CCCD che, tìm được theo số CCCD đầy đủ', async () => {
    const cookie = await loginAs('admin');
    const page = AccountsResponseSchema.parse((await request(server()).get('/api/accounts').set('Cookie', cookie).expect(200)).body);
    expect(page.accounts.length).toBeGreaterThan(0);
    expect(JSON.stringify(page)).not.toContain('079188001122');

    const found = AccountsResponseSchema.parse(
      (await request(server()).get('/api/accounts').query({ search: '079188001122' }).set('Cookie', cookie).expect(200)).body,
    );
    expect(found.accounts.map((account) => account.id)).toEqual(['cb-1']);
  });

  it('GET /accounts tham số sai: 422', async () => {
    const cookie = await loginAs('admin');
    const response = await request(server()).get('/api/accounts?page=abc').set('Cookie', cookie).expect(422);
    expect(ApiErrorBodySchema.parse(response.body).message).toBe(COMMON_MESSAGES.listQuery);
  });

  it('GET /accounts/cccds chỉ trả CCCD của người được hỏi; thiếu userIds: 422', async () => {
    const cookie = await loginAs('admin');
    const response = await request(server()).get('/api/accounts/cccds?userIds=cb-1,sv-2').set('Cookie', cookie).expect(200);
    expect(AccountCccdsResponseSchema.parse(response.body).cccds).toEqual({ 'cb-1': '079188001122' });
    const bad = await request(server()).get('/api/accounts/cccds').set('Cookie', cookie).expect(422);
    expect(ApiErrorBodySchema.parse(bad.body).message).toBe(COMMON_MESSAGES.userIds);
  });

  it('POST /accounts tạo tài khoản (201), chưa bổ sung thông tin; trùng email hoặc CCCD: 409; body sai: 422', async () => {
    const cookie = await loginAs('admin');
    const input = { name: 'Tài Khoản Thử', email: TEST_EMAIL, role: 'nguoiNopDon', cccd: '', phone: '' };
    const created = AccountSchema.parse((await request(server()).post('/api/accounts').set('Cookie', cookie).send(input).expect(201)).body);
    expect(created).toMatchObject({ name: 'Tài Khoản Thử', email: TEST_EMAIL, role: 'nguoiNopDon', phone: null, maskedCccd: null });
    expect((await prisma.user.findUnique({ where: { id: created.id } }))?.completed).toBe(false);

    const sameEmail = await request(server()).post('/api/accounts').set('Cookie', cookie).send(input).expect(409);
    expect(ApiErrorBodySchema.parse(sameEmail.body).message).toBe(ACCOUNT_MESSAGES.emailTaken);

    const sameCccd = await request(server())
      .post('/api/accounts')
      .set('Cookie', cookie)
      .send({ ...input, email: 'khac.thu@hcmulaw.edu.vn', cccd: '079188001122' })
      .expect(409);
    expect(ApiErrorBodySchema.parse(sameCccd.body).message).toBe(ACCOUNT_MESSAGES.cccdTaken);

    await request(server()).post('/api/accounts').set('Cookie', cookie).send({ ...input, email: 'ai.do@gmail.com' }).expect(422);
  });

  it('PUT /accounts/:userId sửa tên, SĐT, CCCD, vai trò; CCCD trùng: 409; không có tài khoản: 404', async () => {
    const cookie = await loginAs('admin');
    const edit = { name: 'Trần Quốc Việt Mới', phone: '0911222333', cccd: '079199009900', role: 'admin' };
    const saved = AccountSchema.parse((await request(server()).put('/api/accounts/cb-2').set('Cookie', cookie).send(edit).expect(200)).body);
    expect(saved).toMatchObject({ id: 'cb-2', name: 'Trần Quốc Việt Mới', phone: '0911222333', role: 'admin' });
    expect(saved.maskedCccd).toMatch(/•/);

    const taken = await request(server()).put('/api/accounts/cb-2').set('Cookie', cookie).send({ ...edit, cccd: '079188001122' }).expect(409);
    expect(ApiErrorBodySchema.parse(taken.body).message).toBe(ACCOUNT_MESSAGES.cccdTaken);

    const missing = await request(server()).put('/api/accounts/khong-co').set('Cookie', cookie).send(edit).expect(404);
    expect(ApiErrorBodySchema.parse(missing.body).message).toBe(ACCOUNT_MESSAGES[404]);

    await request(server()).put('/api/accounts/cb-2').set('Cookie', cookie).send({ ...edit, name: 'A' }).expect(422);
  });

  it('Admin không tự đổi vai trò của mình: 422; đổi tên của mình thì được', async () => {
    const cookie = await loginAs('admin');
    const own = { name: 'Lê Ngọc Diệp', phone: '0987654321', cccd: '079190003344', role: 'nguoiXuLiDon' };
    const response = await request(server()).put('/api/accounts/cb-3').set('Cookie', cookie).send(own).expect(422);
    expect(ApiErrorBodySchema.parse(response.body).message).toBe(ACCOUNT_MESSAGES.ownRole);
    await request(server()).put('/api/accounts/cb-3').set('Cookie', cookie).send({ ...own, role: 'admin' }).expect(200);
  });
});
