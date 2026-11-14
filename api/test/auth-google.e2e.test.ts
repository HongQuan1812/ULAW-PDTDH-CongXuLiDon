/* Test đăng nhập Google (tắt ENABLE_DEMO_APIS, APP_ENV vẫn dev): POST /auth/login trả đường dẫn sang Google, Google chuyển về
   (giả lập phản hồi đổi code của Google), lỗi và chưa cấu hình.
   Cần database đã migrate và seed (pnpm --filter api exec prisma db seed). */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AUTH_MESSAGES, SessionSchema } from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
/** Email trường chưa có tài khoản: lần đầu đăng nhập sẽ tạo tài khoản mới. */
const NEW_SCHOOL_EMAIL = 'google.test.moi@student.hcmulaw.edu.vn';
/** Tài khoản mẫu đã có (cb-3, Admin). */
const EXISTING_EMAIL = 'ngocdiep.le.pdt@hcmulaw.edu.vn';

/** Dựng ID token giả (JWT không ký) Google trả về cho một email. */
function fakeIdToken(email: string, name = 'Người Thử Google'): string {
  const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
  const claims = { iss: 'https://accounts.google.com', aud: CLIENT_ID, exp: Date.now() / 1000 + 600, email, email_verified: true, name };
  return `${encode({ alg: 'RS256' })}.${encode(claims)}.chu-ky`;
}

/** Lấy phần "tên=giá trị" của các cookie trong response. */
function cookiesOf(response: request.Response): string[] {
  return ((response.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map((cookie) => cookie.split(';')[0]!);
}

/** Biến môi trường test này đổi; trả lại như cũ sau khi xong. */
const CHANGED_ENV = ['ENABLE_DEMO_APIS', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const;
const originalEnv = Object.fromEntries(CHANGED_ENV.map((name) => [name, process.env[name]]));

/**
 * Dùng bản thật (ENABLE_DEMO_APIS trống) với OAuth client cho trước.
 * @param clientId      GOOGLE_CLIENT_ID; trống = chưa cấu hình
 * @param clientSecret  GOOGLE_CLIENT_SECRET
 */
function useGoogleLogin(clientId: string, clientSecret: string): void {
  process.env['ENABLE_DEMO_APIS'] = '';
  process.env['GOOGLE_CLIENT_ID'] = clientId;
  process.env['GOOGLE_CLIENT_SECRET'] = clientSecret;
}

/** Trả biến môi trường về như trước test. */
function restoreEnv(): void {
  for (const name of CHANGED_ENV) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
}

/**
 * Bấm "Đăng nhập bằng email trường".
 * @param app   ứng dụng
 * @param from  trang cần mở sau khi đăng nhập
 * @returns     response của POST /auth/login (200)
 */
function startLogin(app: INestApplication, from?: string) {
  return request(app.getHttpServer()).post('/api/auth/login').send(from ? { from } : {}).expect(200);
}

/** Đường dẫn sang Google trong response của POST /auth/login. */
function googleUrlOf(response: request.Response): URL {
  expect(response.body.kind).toBe('redirect');
  return new URL(response.body.url as string);
}

describe('đăng nhập Google, đã cấu hình OAuth client', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    useGoogleLogin(CLIENT_ID, 'test-secret');
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: NEW_SCHOOL_EMAIL } });
    await app.close();
    restoreEnv();
  });

  /**
   * Đi hết luồng: bấm đăng nhập (POST /auth/login), rồi giả làm Google chuyển về kèm code và state.
   * @param googleResponse  phản hồi giả của Google khi đổi code
   * @param from            trang cần mở sau khi đăng nhập
   * @returns               response của lần Google chuyển về, và yêu cầu đổi code đã gửi Google
   */
  async function loginThroughGoogle(googleResponse: Response, from = '/quan-li-don') {
    const start = await startLogin(app, from);
    const state = googleUrlOf(start).searchParams.get('state');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(googleResponse);
    const callback = await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ code: 'ma-tu-google', state })
      .set('Cookie', cookiesOf(start).join('; '))
      .expect(302);
    return { callback, fetchSpy };
  }

  it('POST /auth/login: trả đường dẫn sang Google kèm client, redirect URI, PKCE; đặt cookie state httpOnly; bỏ qua vai trò thử', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/login').send({ role: 'admin' }).expect(200);
    const location = googleUrlOf(response);
    expect(location.host).toBe('accounts.google.com');
    expect(location.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(location.searchParams.get('redirect_uri')).toMatch(/\/api\/auth\/google\/callback$/);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    const stateCookie = (response.headers['set-cookie'] as unknown as string[])[0]!;
    expect(stateCookie).toMatch(/^ulaw_google_oauth=/);
    expect(stateCookie).toContain('HttpOnly');
    expect(stateCookie).toContain('Path=/api/auth/google');
  });

  it('email trường chưa có tài khoản: tạo tài khoản Người nộp đơn, họ tên trống, chưa bổ sung thông tin; đăng nhập, về trang cần mở', async () => {
    const googleResponse = Response.json({ id_token: fakeIdToken(NEW_SCHOOL_EMAIL) });
    const { callback, fetchSpy } = await loginThroughGoogle(googleResponse);

    // Đã đổi code với Google bằng mã PKCE
    const sentBody = new URLSearchParams(String(fetchSpy.mock.calls[0]![1]!.body));
    expect(sentBody.get('code')).toBe('ma-tu-google');
    expect(sentBody.get('code_verifier')).toBeTruthy();

    // Về đúng trang trong giao diện, có phiên
    expect(callback.headers['location']).toMatch(/\/#\/quan-li-don$/);
    const sessionCookie = cookiesOf(callback).find((cookie) => cookie.startsWith('ulaw_session='));
    expect(sessionCookie).toBeTruthy();
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', sessionCookie!).expect(200);
    expect(SessionSchema.parse(me.body)).toMatchObject({
      user: { email: NEW_SCHOOL_EMAIL, name: '' },
      role: 'nguoiNopDon',
      profileCompleted: false,
    });
  });

  it('email đã có tài khoản: đăng nhập vào đúng tài khoản đó, giữ vai trò', async () => {
    const { callback } = await loginThroughGoogle(Response.json({ id_token: fakeIdToken(EXISTING_EMAIL) }));
    const sessionCookie = cookiesOf(callback).find((cookie) => cookie.startsWith('ulaw_session='))!;
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', sessionCookie).expect(200);
    expect(me.body).toMatchObject({ user: { id: 'cb-3' }, role: 'admin' });
  });

  it('email ngoài trường: không tạo tài khoản, không có phiên, về trang Đăng nhập kèm loginError=notSchoolEmail', async () => {
    const { callback } = await loginThroughGoogle(Response.json({ id_token: fakeIdToken('an.nguyen@gmail.com') }));
    expect(callback.headers['location']).toMatch(/\/#\/dang-nhap\?loginError=notSchoolEmail&email=an.nguyen%40gmail.com$/);
    expect(cookiesOf(callback).some((cookie) => cookie.startsWith('ulaw_session='))).toBe(false);
    expect(await prisma.user.findUnique({ where: { email: 'an.nguyen@gmail.com' } })).toBeNull();
  });

  it('Google từ chối đổi code: về trang Đăng nhập kèm loginError=failed', async () => {
    const { callback } = await loginThroughGoogle(Response.json({ error: 'invalid_grant' }, { status: 400 }));
    expect(callback.headers['location']).toMatch(/\/#\/dang-nhap\?loginError=failed$/);
  });

  it('state không khớp cookie, hoặc không có cookie (trang khác giả mạo / quá 10 phút): failed, không gọi Google', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const start = await startLogin(app);
    const wrongState = await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ code: 'ma', state: 'state-khac' })
      .set('Cookie', cookiesOf(start).join('; '))
      .expect(302);
    expect(wrongState.headers['location']).toMatch(/loginError=failed$/);
    const noCookie = await request(app.getHttpServer()).get('/api/auth/google/callback').query({ code: 'ma', state: 'x' }).expect(302);
    expect(noCookie.headers['location']).toMatch(/loginError=failed$/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('người dùng bấm Hủy ở Google (không có code): failed', async () => {
    const start = await startLogin(app);
    const state = googleUrlOf(start).searchParams.get('state');
    const response = await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ error: 'access_denied', state })
      .set('Cookie', cookiesOf(start).join('; '))
      .expect(302);
    expect(response.headers['location']).toMatch(/loginError=failed$/);
  });

  it('?from= trỏ ra trang web khác thì sau khi đăng nhập về trang chính', async () => {
    const { callback } = await loginThroughGoogle(Response.json({ id_token: fakeIdToken(EXISTING_EMAIL) }), '//evil.com');
    expect(callback.headers['location']).toMatch(/\/#\/$/);
  });
});

describe('đăng nhập Google, chưa cấu hình OAuth client', () => {
  let app: INestApplication;

  beforeAll(async () => {
    useGoogleLogin('', '');
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  it('POST /auth/login: 503 kèm câu báo chưa bật đăng nhập Google', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(503);
    expect(response.body.message).toBe(AUTH_MESSAGES.googleNotConfigured);
  });
});
