/* Test nhóm API auth và guard quyền. Cần database đã migrate và seed (pnpm --filter api exec prisma db seed). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ApiErrorBodySchema, AUTH_MESSAGES, LoginResponseSchema, SessionSchema, type RoleId } from '@ulaw/shared';
import { RequireLogin, RequirePermission } from '../src/auth/require-permission.decorator';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

const FORBIDDEN_TEST_MESSAGE = 'Bạn không có quyền xem trang thử.';

/** Route chỉ có trong test, để thử guard. */
@Controller('test-guard')
class GuardProbeController {
  @Get('login-only')
  @RequireLogin()
  loginOnly(): { ok: true } {
    return { ok: true };
  }

  @Get('accounts-only')
  @RequirePermission('manageAccounts', FORBIDDEN_TEST_MESSAGE)
  accountsOnly(): { ok: true } {
    return { ok: true };
  }
}

describe('auth', () => {
  let app: INestApplication;

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(app.getHttpServer()).post('/api/auth/login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  beforeAll(async () => {
    app = await createTestApp([GuardProbeController]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /auth/me chưa đăng nhập: 401', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(ApiErrorBodySchema.parse(response.body).message).toBe(AUTH_MESSAGES[401]);
  });

  it('đăng nhập thử trả Session đúng hợp đồng và cookie httpOnly', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/login').send({ role: 'nguoiXuLiDon' }).expect(200);
    expect(LoginResponseSchema.parse(response.body)).toMatchObject({ kind: 'session' });
    expect(SessionSchema.parse(response.body.session)).toMatchObject({ user: { id: 'cb-1' }, role: 'nguoiXuLiDon' });
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/^ulaw_session=[0-9a-f]{64};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('có cookie thì GET /auth/me trả đúng người, vai trò, profileCompleted', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const response = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(SessionSchema.parse(response.body)).toMatchObject({ user: { id: 'sv-1' }, role: 'nguoiNopDon', profileCompleted: false });
  });

  it('cookie sai: 401', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', 'ulaw_session=khong-co').expect(401);
  });

  it('đăng xuất: 204, cookie cũ hết dùng được', async () => {
    const cookie = await loginAs('admin');
    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(204);
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  it('đăng nhập lại (đổi vai trò) thì phiên cũ hết dùng được', async () => {
    const oldCookie = await loginAs('nguoiNopDon');
    const response = await request(app.getHttpServer()).post('/api/auth/login').set('Cookie', oldCookie).send({ role: 'admin' }).expect(200);
    expect(response.body.session.role).toBe('admin');
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', oldCookie).expect(401);
  });

  it('đăng nhập xóa các phiên đã hết hạn', async () => {
    const prisma = app.get(PrismaService);
    await prisma.authSession.create({
      data: { tokenHash: 'phien-het-han-de-thu', userId: 'sv-1', expiresAt: new Date(Date.now() - 1000) },
    });
    await loginAs('admin');
    expect(await prisma.authSession.findUnique({ where: { tokenHash: 'phien-het-han-de-thu' } })).toBeNull();
  });

  it('đăng xuất khi chưa đăng nhập vẫn 204', async () => {
    await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
  });

  it('đăng nhập thử với email ngoài trường: 403, không tạo phiên', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ role: 'nguoiNopDon', email: 'an@gmail.com' })
      .expect(403);
    expect(response.body.message).toBe(AUTH_MESSAGES[403]('an@gmail.com'));
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('POST /auth/login khi ENABLE_DEMO_APIS=true: đăng nhập thử luôn (không qua Google), đúng vai trò; không gửi vai trò thì Người nộp đơn', async () => {
    const asAdmin = await request(app.getHttpServer()).post('/api/auth/login').send({ role: 'admin' }).expect(200);
    expect(asAdmin.body.kind).toBe('session');
    expect(SessionSchema.parse(asAdmin.body.session).role).toBe('admin');
    expect((asAdmin.headers['set-cookie'] as unknown as string[]).some((cookie) => cookie.startsWith('ulaw_session='))).toBe(true);
    const noRole = await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(200);
    expect(noRole.body.session.role).toBe('nguoiNopDon');
  });

  it('đăng nhập với vai trò sai: 422', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/login').send({ role: 'hacker' }).expect(422);
    expect(response.body.message).toBe(AUTH_MESSAGES[422]);
  });

  it('guard: chưa đăng nhập 401; đăng nhập rồi thiếu quyền 403; đủ quyền 200', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/test-guard/login-only').expect(401);
    await request(server).get('/api/test-guard/accounts-only').expect(401);

    const studentCookie = await loginAs('nguoiNopDon');
    await request(server).get('/api/test-guard/login-only').set('Cookie', studentCookie).expect(200);
    const forbidden = await request(server).get('/api/test-guard/accounts-only').set('Cookie', studentCookie).expect(403);
    expect(forbidden.body.message).toBe(FORBIDDEN_TEST_MESSAGE);

    const adminCookie = await loginAs('admin');
    await request(server).get('/api/test-guard/accounts-only').set('Cookie', adminCookie).expect(200);
  });
});
