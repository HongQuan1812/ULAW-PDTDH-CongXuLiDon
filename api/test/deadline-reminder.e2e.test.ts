/* Test thư nhắc hạn: chỉ gửi từ 07:00; Sắp tới hạn, Quá hạn mỗi loại một lần cho mỗi hạn; hạn lùi vì bổ sung thì nhắc lại;
   đang chờ bổ sung thì không nhắc; gửi lỗi thì lần sau gửi lại.
   Dùng một lá đơn thử riêng (thời gian xử lí tối đa 2 ngày, nộp 10:00 Thứ Hai 07/12/2026, hạn 10:00 Thứ Tư 09/12), gọi thẳng một lần kiểm với giờ chọn sẵn.
   Không gửi thư thật: thay lệnh gửi bằng hàm giả. Cần database đã migrate và seed; xong thì xóa đơn thử, trả hai cột hạn đã nhắc của đơn mẫu về như cũ. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import type { FormEventAction, FormStatus } from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { AppConfig } from '../src/config/app-config';
import { fromVietnamTime } from '../src/common/vietnam-time';
import { DeadlineReminderService } from '../src/email/deadline-reminder.service';
import { MailSenderService, type OutgoingEmail } from '../src/email/mail-sender.service';
import type { Prisma } from '../src/generated/prisma/client';
import { createTestApp } from './create-test-app';

/** Mã lá đơn thử, không trùng đơn mẫu. */
const TEST_CODE = 'XMR-2026-001-99001';

/** Hạn của đơn thử (giờ Việt Nam). */
const DUE_AT = '2026-12-09T10:00';

describe('thư nhắc hạn xử lí', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reminders: DeadlineReminderService;
  let sendMock: ReturnType<typeof vi.fn<(email: OutgoingEmail) => Promise<boolean>>>;
  let remindedBackup: { code: string; dueSoonRemindedFor: Date | null; overdueRemindedFor: Date | null }[];

  /**
   * Một lần kiểm vào giờ chọn sẵn, chỉ lấy các thư của đơn thử.
   * @param vietnamTime  giờ Việt Nam 'YYYY-MM-DDTHH:mm'
   * @returns            các loại thư nhắc đã gửi cho đơn thử
   */
  async function checkAt(vietnamTime: string): Promise<string[]> {
    const sent = await reminders.checkReminders(fromVietnamTime(vietnamTime));
    return sent.filter((reminder) => reminder.code === TEST_CODE).map((reminder) => `${reminder.kind} ${reminder.dueAt}`);
  }

  /**
   * Thêm một dòng lịch sử cho đơn thử và đổi trạng thái theo dòng đó.
   * @param action  việc
   * @param at      lúc làm, giờ Việt Nam
   * @param status  trạng thái sau việc đó
   */
  async function addEvent(action: FormEventAction, at: string, status: FormStatus): Promise<void> {
    await prisma.formEvent.create({ data: { formCode: TEST_CODE, action, status, actorId: 'cb-1', at: fromVietnamTime(at) } });
    await prisma.form.update({ where: { code: TEST_CODE }, data: { status } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    reminders = app.get(DeadlineReminderService);
    // Bản giả dev-email gửi về địa chỉ nhận thay (test để trống thì chỉ in ra, không tính là đã gửi)
    (app.get(AppConfig) as unknown as { devEmailRedirectTo: string | null }).devEmailRedirectTo = 'hop.thu.dev@hcmulaw.edu.vn';
    remindedBackup = await prisma.form.findMany({ select: { code: true, dueSoonRemindedFor: true, overdueRemindedFor: true } });

    // Thay lệnh gửi: ghi lại thư thay vì gửi đi
    sendMock = vi.fn(async () => true);
    vi.spyOn(app.get(MailSenderService), 'send').mockImplementation((email) => sendMock(email));
  });

  beforeEach(async () => {
    // Đơn thử: Đang xét, cán bộ cb-1 xử lí, thời gian xử lí tối đa 2 ngày làm việc
    const template = await prisma.form.findFirstOrThrow({ where: { code: { startsWith: 'XMR-' } } });
    const snapshot = { ...(template.formTypeSnapshot as Record<string, unknown>), maxProcessingDays: 2 };
    const submittedAt = fromVietnamTime('2026-12-07T10:00');
    await prisma.form.create({
      data: {
        code: TEST_CODE,
        ownerId: template.ownerId,
        formTypeId: template.formTypeId,
        formTypeVersion: template.formTypeVersion,
        status: 'xet',
        submittedAt,
        updatedAt: submittedAt,
        handlerId: 'cb-1',
        handlerSince: submittedAt,
        answers: template.answers as Prisma.InputJsonValue,
        formTypeSnapshot: snapshot as Prisma.InputJsonValue,
      },
    });
    await prisma.formEvent.create({ data: { formCode: TEST_CODE, action: 'submit', status: 'nop', actorId: template.ownerId, at: submittedAt } });
    await addEvent('receive', '2026-12-07T11:00', 'xet');
  });

  afterEach(async () => {
    await prisma.form.deleteMany({ where: { code: TEST_CODE } });
    sendMock.mockReset();
    sendMock.mockImplementation(async () => true);
  });

  afterAll(async () => {
    for (const { code, ...reminded } of remindedBackup) await prisma.form.update({ where: { code }, data: reminded });
    await app.close();
  });

  it('trước 07:00: không kiểm, không gửi', async () => {
    expect(await reminders.checkReminders(fromVietnamTime('2026-12-08T06:50'))).toEqual([]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('còn hơn 1 ngày: không nhắc; Sắp tới hạn, Quá hạn: mỗi loại gửi một lần', async () => {
    expect(await checkAt('2026-12-08T09:50')).toEqual([]);
    expect(await checkAt('2026-12-08T10:10')).toEqual([`dueSoon ${DUE_AT}`]);
    expect(await checkAt('2026-12-08T10:20')).toEqual([]);
    expect(await checkAt('2026-12-09T10:10')).toEqual([`overdue ${DUE_AT}`]);
    expect(await checkAt('2026-12-09T10:20')).toEqual([]);
    expect(await checkAt('2026-12-10T08:00')).toEqual([]);

    const saved = await prisma.form.findUniqueOrThrow({ where: { code: TEST_CODE } });
    expect(saved.dueSoonRemindedFor).toEqual(fromVietnamTime(DUE_AT));
    expect(saved.overdueRemindedFor).toEqual(fromVietnamTime(DUE_AT));
  });

  it('đang chờ bổ sung: không nhắc; bổ sung xong hạn lùi thì nhắc lại theo hạn mới', async () => {
    expect(await checkAt('2026-12-08T10:10')).toEqual([`dueSoon ${DUE_AT}`]);

    // Dừng đồng hồ lúc còn 23 giờ, hai ngày sau mới bổ sung
    await addEvent('requestSupplement', '2026-12-08T11:00', 'bs');
    expect(await checkAt('2026-12-09T11:00')).toEqual([]);
    await addEvent('supplement', '2026-12-10T11:00', 'bsg');

    // Hạn mới 10:00 Thứ Sáu 11/12, đang Sắp tới hạn: nhắc lại
    expect(await checkAt('2026-12-10T11:10')).toEqual(['dueSoon 2026-12-11T10:00']);
    expect(await checkAt('2026-12-10T11:20')).toEqual([]);
  });

  it('gửi lỗi: không ghi, lần kiểm sau gửi lại', async () => {
    sendMock.mockImplementation(async () => false);
    expect(await checkAt('2026-12-08T10:10')).toEqual([]);
    expect((await prisma.form.findUniqueOrThrow({ where: { code: TEST_CODE } })).dueSoonRemindedFor).toBeNull();

    sendMock.mockImplementation(async () => true);
    expect(await checkAt('2026-12-08T10:20')).toEqual([`dueSoon ${DUE_AT}`]);
  });

  it('đã có kết quả: không nhắc', async () => {
    await addEvent('approve', '2026-12-08T09:00', 'duyet');
    expect(await checkAt('2026-12-09T10:10')).toEqual([]);
  });
});
