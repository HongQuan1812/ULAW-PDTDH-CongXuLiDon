/* Test thư tự động báo cho người nộp đơn: dựng thư theo cấu hình và dữ liệu đơn, lúc gửi đang tắt thì không gửi,
   bản giả dev-email thì gửi về địa chỉ nhận thay (chưa đặt thì chỉ in ra), bản thật gửi tới người nộp đơn.
   Thư cho cán bộ: Được chuyển giao gửi người xử lí; thư nhắc hạn gửi người xử lí, đơn chưa có người xử lí thì gửi mọi Admin.
   Không gửi thư thật: thay lệnh gửi bằng hàm giả.
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
const FORM_CODE = 'XMR-2026-001-01520';

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

  it('dựng thư theo cấu hình của lúc gửi và dữ liệu đơn; bản giả dev-email gửi về địa chỉ nhận thay', async () => {
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
    await writeSettings({ ...EMAIL_SETTINGS_SEED, events: EMAIL_SETTINGS_SEED.events.map((event) => ({ ...event, enabled: event.kind !== 'duyet' })) });
    expect(await formEmail.sendStatusEmail(FORM_CODE, 'duyet')).toBe(false);
    expect(await formEmail.sendStatusEmail(FORM_CODE, 'nop')).toBe(true);
    expect(sentEmails).toHaveLength(1);
  });

  it('cấu hình lưu kiểu cũ (bốn lúc gửi, ghi status): vẫn gửi theo thư đã lưu', async () => {
    const oldSettings = {
      sender: EMAIL_SETTINGS_SEED.sender,
      events: EMAIL_SETTINGS_SEED.events.slice(0, 4).map(({ kind, ...event }) => ({ ...event, status: kind, subject: `Cũ ${kind}` })),
    };
    await prisma.emailSettings.update({ where: { id: 1 }, data: { settings: oldSettings as unknown as Prisma.InputJsonValue } });
    expect(await formEmail.sendStatusEmail(FORM_CODE, 'bs')).toBe(true);
    expect(sentEmails.map((email) => email.subject)).toEqual(['Cũ bs']);
  });

  it('mã {han_xu_li}: điền hạn xử lí của đơn', async () => {
    const tagged: EmailSettings = {
      ...EMAIL_SETTINGS_SEED,
      events: EMAIL_SETTINGS_SEED.events.map((event) => (event.kind === 'nop' ? { ...event, subject: 'Hạn: {han_xu_li}' } : event)),
    };
    await writeSettings(tagged);
    expect(await formEmail.sendStatusEmail(FORM_CODE, 'nop')).toBe(true);
    expect(sentEmails[0]!.subject).toMatch(/^Hạn: (\d{2}:\d{2} · \d{2}\/\d{2}\/\d{4}|Không giới hạn|Chưa có, chờ bổ sung)$/);
    expect(sentEmails[0]!.subject).not.toContain('{han_xu_li}');
  });

  it('bản thật (dev-email trong ALWAYS_REAL_APIS): gửi tới email người nộp đơn, không về địa chỉ nhận thay', async () => {
    const usesDemoApi = vi.spyOn(app.get(AppConfig), 'usesDemoApi').mockImplementation((api) => api !== 'dev-email');
    try {
      const form = await prisma.form.findUniqueOrThrow({ where: { code: FORM_CODE }, include: { owner: true } });
      expect(await formEmail.sendStatusEmail(FORM_CODE, 'nop')).toBe(true);
      expect(sentEmails.map((email) => email.to)).toEqual([form.owner.email]);
    } finally {
      usesDemoApi.mockRestore();
    }
  });

  it('bản giả chưa đặt địa chỉ nhận thay: chỉ in ra, không gửi; không có đơn: không gửi', async () => {
    config.devEmailRedirectTo = null;
    expect(await formEmail.sendStatusEmail(FORM_CODE, 'nop')).toBe(false);
    config.devEmailRedirectTo = REDIRECT_ADDRESS;
    expect(await formEmail.sendStatusEmail('XMR-2026-001-99999', 'nop')).toBe(false);
    expect(sentEmails).toHaveLength(0);
  });
  it('thư Được chuyển giao (bản thật): gửi người xử lí hiện tại, điền tên người chuyển giao', async () => {
    const usesDemoApi = vi.spyOn(app.get(AppConfig), 'usesDemoApi').mockImplementation((api) => api !== 'dev-email');
    try {
      const form = await prisma.form.findFirstOrThrow({ where: { handlerId: { not: null } }, include: { handler: true } });
      expect(await formEmail.sendTransferEmail(form.code, 'Người Chuyển Thử')).toBe('sent');
      expect(sentEmails.map((email) => email.to)).toEqual([form.handler!.email]);
      expect(sentEmails[0]!.text).toContain('Người Chuyển Thử đã chuyển giao');
      expect(sentEmails[0]!.text).toContain(`Kính gửi ${form.handler!.name},`);
    } finally {
      usesDemoApi.mockRestore();
    }
  });

  it('thư nhắc hạn (bản thật): có người xử lí thì gửi người đó; chưa có thì gửi mọi Admin', async () => {
    const usesDemoApi = vi.spyOn(app.get(AppConfig), 'usesDemoApi').mockImplementation((api) => api !== 'dev-email');
    try {
      const handled = await prisma.form.findFirstOrThrow({ where: { handlerId: { not: null } }, include: { handler: true } });
      expect(await formEmail.sendReminderEmail(handled.code, 'overdue')).toBe('sent');
      expect(sentEmails.map((email) => email.to)).toEqual([handled.handler!.email]);

      sentEmails.length = 0;
      const unhandled = await prisma.form.findFirstOrThrow({ where: { handlerId: null } });
      const admins = await prisma.user.findMany({ where: { role: 'admin' }, orderBy: { email: 'asc' } });
      expect(admins.length).toBeGreaterThan(0);
      expect(await formEmail.sendReminderEmail(unhandled.code, 'dueSoon')).toBe('sent');
      expect(sentEmails.map((email) => email.to)).toEqual(admins.map((admin) => admin.email));
    } finally {
      usesDemoApi.mockRestore();
    }
  });

  it('thư cho cán bộ, bản giả dev-email: nhiều người nhận vẫn chỉ một thư về địa chỉ nhận thay; lúc gửi đang tắt thì không gửi', async () => {
    const unhandled = await prisma.form.findFirstOrThrow({ where: { handlerId: null } });
    expect(await formEmail.sendReminderEmail(unhandled.code, 'overdue')).toBe('sent');
    expect(sentEmails.map((email) => email.to)).toEqual([REDIRECT_ADDRESS]);

    sentEmails.length = 0;
    await writeSettings({ ...EMAIL_SETTINGS_SEED, events: EMAIL_SETTINGS_SEED.events.map((event) => ({ ...event, enabled: event.kind !== 'overdue' })) });
    expect(await formEmail.sendReminderEmail(unhandled.code, 'overdue')).toBe('skipped');
    expect(sentEmails).toHaveLength(0);
  });
});
