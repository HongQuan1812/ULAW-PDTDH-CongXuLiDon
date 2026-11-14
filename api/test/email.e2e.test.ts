/* Test nhóm API email: Cấu hình email (xem, lưu, gửi thư thử).
   Cần database đã migrate và seed. Test ghi lại dòng cấu hình lúc đầu rồi trả lại như cũ khi xong.
   Test bỏ SMTP_HOST (test/setup-env.ts), nên thư chỉ in ra console, không gửi đi dù api/.env có máy chủ thư. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import {
  ApiErrorBodySchema,
  EMAIL_ENDPOINTS,
  EMAIL_SAMPLE_VALUES,
  EMAIL_MESSAGES,
  EMAIL_SETTINGS_SEED,
  EmailSettingsResponseSchema,
  SendTestEmailResponseSchema,
  DEMO_USER_IDS,
  EMPTY_RICH_TEXT_DOC,
  formLink,
  type EmailSettings,
  type RoleId,
  type SendTestEmailRequest,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { AppConfig } from '../src/config/app-config';
import { MailSenderService } from '../src/email/mail-sender.service';
import type { Prisma } from '../src/generated/prisma/client';
import { createTestApp } from './create-test-app';

/**
 * Câu báo lỗi trong body response, đúng dạng ApiErrorBody.
 * @param response  response lỗi
 * @returns         câu báo
 */
const messageOf = (response: Response) => ApiErrorBodySchema.parse(response.body).message;

/** Thư thử hợp lệ, theo lúc gửi đầu tiên của cấu hình mẫu. */
const TEST_EMAIL: SendTestEmailRequest = {
  to: 'nguoi.nhan@hcmulaw.edu.vn',
  sender: EMAIL_SETTINGS_SEED.sender,
  subject: EMAIL_SETTINGS_SEED.events[0]!.subject,
  body: EMAIL_SETTINGS_SEED.events[0]!.body,
};

describe('email', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let originalRow: Awaited<ReturnType<PrismaService['emailSettings']['findUniqueOrThrow']>>;
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    originalRow = await prisma.emailSettings.findUniqueOrThrow({ where: { id: 1 } });
  });

  afterAll(async () => {
    const { id, ...originalFields } = originalRow;
    await prisma.emailSettings.update({ where: { id }, data: { ...originalFields, settings: originalFields.settings as Prisma.InputJsonValue } });
    await app.close();
  });

  it('chưa đăng nhập: 401', async () => {
    const response = await request(server()).get(`/api${EMAIL_ENDPOINTS.settings}`).expect(401);
    expect(messageOf(response)).toBe(EMAIL_MESSAGES[401]);
  });

  it('người nộp đơn (không có quyền manageEmail): 403 ở mọi lệnh', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const response = await request(server()).get(`/api${EMAIL_ENDPOINTS.settings}`).set('Cookie', cookie).expect(403);
    expect(messageOf(response)).toBe(EMAIL_MESSAGES[403]);
    await request(server()).put(`/api${EMAIL_ENDPOINTS.settings}`).set('Cookie', cookie).send(EMAIL_SETTINGS_SEED).expect(403);
    await request(server()).post(`/api${EMAIL_ENDPOINTS.test}`).set('Cookie', cookie).send(TEST_EMAIL).expect(403);
  });

  it('xem: cấu hình, lần lưu, địa chỉ gửi, máy chủ thư', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const response = await request(server()).get(`/api${EMAIL_ENDPOINTS.settings}`).set('Cookie', cookie).expect(200);
    const settingsResponse = EmailSettingsResponseSchema.parse(response.body);
    expect(settingsResponse.settings.events.map((event) => event.status)).toEqual(['nop', 'bs', 'tc', 'duyet']);
    expect(settingsResponse.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(settingsResponse.mailServerConnected).toBe(true);
  });

  it('lưu: ghi người lưu; xem lại thấy bản mới', async () => {
    const cookie = await loginAs('admin');
    const newSettings: EmailSettings = {
      sender: { name: 'Phòng Đào tạo (thử)', signature: '' },
      events: EMAIL_SETTINGS_SEED.events.map((event) => ({ ...event, enabled: event.status !== 'tc' })),
    };
    const saveResponse = await request(server()).put(`/api${EMAIL_ENDPOINTS.settings}`).set('Cookie', cookie).send(newSettings).expect(200);
    const saved = EmailSettingsResponseSchema.parse(saveResponse.body);
    expect(saved.settings).toEqual(newSettings);
    expect(saved.updatedBy.id).toBe(DEMO_USER_IDS.admin);

    const readResponse = await request(server()).get(`/api${EMAIL_ENDPOINTS.settings}`).set('Cookie', cookie).expect(200);
    expect(EmailSettingsResponseSchema.parse(readResponse.body).settings).toEqual(newSettings);
  });

  it('lưu sai: 422 kèm câu báo của ô bị sai', async () => {
    const cookie = await loginAs('admin');
    const noName = { ...EMAIL_SETTINGS_SEED, sender: { name: ' ', signature: '' } };
    expect(messageOf(await request(server()).put(`/api${EMAIL_ENDPOINTS.settings}`).set('Cookie', cookie).send(noName).expect(422))).toBe('Nhập tên người gửi.');
    const missingEvent = { ...EMAIL_SETTINGS_SEED, events: EMAIL_SETTINGS_SEED.events.slice(1) };
    await request(server()).put(`/api${EMAIL_ENDPOINTS.settings}`).set('Cookie', cookie).send(missingEvent).expect(422);
  });

  it('gửi thư thử: 200 kèm câu báo; địa chỉ, nội dung sai thì 422', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const sentResponse = await request(server()).post(`/api${EMAIL_ENDPOINTS.test}`).set('Cookie', cookie).send({ ...TEST_EMAIL, to: ' Nguoi.Nhan@hcmulaw.edu.vn ' }).expect(200);
    expect(SendTestEmailResponseSchema.parse(sentResponse.body).message).toBe(EMAIL_MESSAGES.testSent(TEST_EMAIL.to));

    const wrongAddress = await request(server()).post(`/api${EMAIL_ENDPOINTS.test}`).set('Cookie', cookie).send({ ...TEST_EMAIL, to: 'khong-phai-email' }).expect(422);
    expect(messageOf(wrongAddress)).toBe('Địa chỉ nhận thử chưa đúng.');
    const emptyBody = await request(server()).post(`/api${EMAIL_ENDPOINTS.test}`).set('Cookie', cookie).send({ ...TEST_EMAIL, body: EMPTY_RICH_TEXT_DOC }).expect(422);
    expect(messageOf(emptyBody)).toBe('Nhập nội dung thư.');
  });

  it('thư thử: dữ liệu mẫu, tiêu đề có [Thử], đường dẫn tới đơn theo địa chỉ cổng của môi trường', async () => {
    const sendSpy = vi.spyOn(app.get(MailSenderService), 'send');
    try {
      const cookie = await loginAs('nguoiXuLiDon');
      await request(server()).post(`/api${EMAIL_ENDPOINTS.test}`).set('Cookie', cookie).send(TEST_EMAIL).expect(200);
      const [email] = sendSpy.mock.calls.at(-1)!;
      expect(email.subject).toBe(`[Thử] [${EMAIL_SAMPLE_VALUES.ma_don}] Đã nhận đơn ${EMAIL_SAMPLE_VALUES.loai_don} của bạn`);
      expect(email.text).toContain(formLink(app.get(AppConfig).webBaseUrl, EMAIL_SAMPLE_VALUES.ma_don));
      expect(email.text).not.toContain(EMAIL_SAMPLE_VALUES.link_don);
    } finally {
      sendSpy.mockRestore();
    }
  });
});
