/* Test thư tự động báo cho người nộp đơn: dựng thư theo cấu hình và dữ liệu đơn, lúc gửi đang tắt thì không gửi,
   khi dev thì gửi về địa chỉ nhận thay (chưa đặt thì chỉ in ra). Không gửi thư thật: thay lệnh gửi bằng hàm giả.
   Cần database đã migrate và seed. Test trả cấu hình email và cấu hình backend về như cũ khi xong. */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { EMAIL_SETTINGS_SEED, formLink, type EmailSettings } from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { AppConfig } from '../src/config/app-config';
import { FormEmailService } from '../src/email/form-email.service';
import { MailSenderService, type OutgoingEmail } from '../src/email/mail-sender.service';
import type { Prisma } from '../src/generated/prisma/client';
import { createTestApp } from './create-test-app';

/** Một lá đơn có trong dữ liệu mẫu. */
const FORM_CODE = 'XMM-2026-001-01520';

/** Địa chỉ nhận thay khi dev, dùng trong test. */
const REDIRECT_ADDRESS = 'hop.thu.dev@hcmulaw.edu.vn';

describe('thư tự động báo cho người nộp đơn', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: { devEmailRedirectTo: string | null };
  let formEmail: FormEmailService;
  let sentEmails: OutgoingEmail[];
  let originalSettings: Prisma.JsonValue;

  /**
   * Ghi cấu hình email thẳng vào database.
   * @param settings  cấu hình cần ghi
   */
  async function writeSettings(settings: EmailSettings): Promise<void> {
    await prisma.emailSettings.update({ where: { id: 1 }, data: { settings: settings as unknown as Prisma.InputJsonValue } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    config = app.get(AppConfig) as unknown as { devEmailRedirectTo: string | null };
    formEmail = app.get(FormEmailService);
    originalSettings = (await prisma.emailSettings.findUniqueOrThrow({ where: { id: 1 } })).settings;

    // Thay lệnh gửi: ghi lại thư thay vì gửi đi
    sentEmails = [];
    vi.spyOn(app.get(MailSenderService), 'send').mockImplementation(async (email) => {
      sentEmails.push(email);
      return true;
    });
  });

  afterEach(async () => {
    sentEmails.length = 0;
    config.devEmailRedirectTo = REDIRECT_ADDRESS;
    await writeSettings(EMAIL_SETTINGS_SEED);
  });

  afterAll(async () => {
    await prisma.emailSettings.update({ where: { id: 1 }, data: { settings: originalSettings as Prisma.InputJsonValue } });
    await app.close();
  });

  it('dựng thư theo cấu hình của lúc gửi và dữ liệu đơn; khi dev gửi về địa chỉ nhận thay', async () => {
    config.devEmailRedirectTo = REDIRECT_ADDRESS;
    await writeSettings(EMAIL_SETTINGS_SEED);
    const form = await prisma.form.findUniqueOrThrow({ where: { code: FORM_CODE }, include: { owner: true } });

    expect(await formEmail.sendStatusEmail(FORM_CODE, 'tc')).toBe(true);
    expect(sentEmails).toHaveLength(1);
    const [email] = sentEmails;
    expect(email).toMatchObject({ to: REDIRECT_ADDRESS, senderName: EMAIL_SETTINGS_SEED.sender.name, subject: `[${FORM_CODE}] Đơn của bạn không được duyệt` });
    expect(email!.text).toContain(`Chào ${form.owner.name},`);
    expect(email!.text).toContain(formLink(app.get(AppConfig).webBaseUrl, FORM_CODE));
    expect(email!.html).toContain(EMAIL_SETTINGS_SEED.sender.signature);
  });

  it('lúc gửi đang tắt: không gửi', async () => {
    await writeSettings({ ...EMAIL_SETTINGS_SEED, events: EMAIL_SETTINGS_SEED.events.map((event) => ({ ...event, enabled: event.status !== 'duyet' })) });
    expect(await formEmail.sendStatusEmail(FORM_CODE, 'duyet')).toBe(false);
    expect(await formEmail.sendStatusEmail(FORM_CODE, 'nop')).toBe(true);
    expect(sentEmails).toHaveLength(1);
  });

  it('khi dev chưa đặt địa chỉ nhận thay: chỉ in ra, không gửi; không có đơn: không gửi', async () => {
    config.devEmailRedirectTo = null;
    expect(await formEmail.sendStatusEmail(FORM_CODE, 'nop')).toBe(false);
    config.devEmailRedirectTo = REDIRECT_ADDRESS;
    expect(await formEmail.sendStatusEmail('XMM-2026-001-99999', 'nop')).toBe(false);
    expect(sentEmails).toHaveLength(0);
  });
});
