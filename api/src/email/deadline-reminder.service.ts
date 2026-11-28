/* Thư nhắc hạn xử lí cho cán bộ: backend tự kiểm mỗi 10 phút, chỉ gửi từ 07:00 (giờ Việt Nam).
   Đơn chưa xong, đang có hạn (không chờ bổ sung) mà Sắp tới hạn hoặc Quá hạn thì gửi thư nhắc tương ứng.
   Mỗi đơn, mỗi loại thư gửi một lần cho mỗi hạn: hạn đã nhắc ghi ở Form.dueSoonRemindedFor / overdueRemindedFor,
   nên restart không gửi trùng; hạn lùi vì bổ sung thì khác giá trị đã ghi, nhắc lại theo hạn mới.
   Gửi lỗi thì không ghi, lần kiểm sau gửi lại. */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { deadlineReminderOf, formDeadline, isReminderTime, type DeadlineReminderKind, type FormStatus, type FormType } from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';
import { fromVietnamTime, toVietnamTime } from '../common/vietnam-time';
import { HolidaysService } from '../holidays/holidays.service';
import { FormEmailService } from './form-email.service';

/** Kiểm thư nhắc mỗi 10 phút. */
const REMINDER_CHECK_MS = 10 * 60_000;

/** Trạng thái đơn chưa xong mà đồng hồ hạn đang chạy (Cần bổ sung: đồng hồ dừng, chưa có hạn). */
const RUNNING_STATUSES: FormStatus[] = ['nop', 'xet', 'bsg'];

/** Cột ghi hạn đã nhắc của từng loại thư. */
const REMINDED_COLUMN = { dueSoon: 'dueSoonRemindedFor', overdue: 'overdueRemindedFor' } as const satisfies Record<DeadlineReminderKind, string>;

/** Một thư nhắc đã gửi trong một lần kiểm. */
export interface SentReminder {
  code: string;
  kind: DeadlineReminderKind;
  /** hạn được nhắc, giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
  dueAt: string;
}

@Injectable()
export class DeadlineReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeadlineReminderService.name);
  /** Bộ hẹn giờ kiểm thư nhắc. */
  private reminderTimer: NodeJS.Timeout | null = null;
  /** Đang có lần kiểm chạy (lần sau tới khi lần trước chưa xong thì bỏ qua). */
  private busy = false;

  /**
   * @param prisma     đọc đơn, ghi hạn đã nhắc
   * @param holidays   ngày nghỉ, để tính hạn
   * @param formEmail  dựng, gửi thư nhắc
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidays: HolidaysService,
    private readonly formEmail: FormEmailService,
  ) {}

  /** Bật backend: bắt đầu kiểm mỗi 10 phút. */
  onModuleInit(): void {
    this.reminderTimer = setInterval(() => {
      this.checkReminders().catch((error: unknown) => this.logger.error(`Kiểm thư nhắc hạn lỗi: ${(error as Error).message}`));
    }, REMINDER_CHECK_MS);
  }

  /** Tắt backend: dừng kiểm. */
  onModuleDestroy(): void {
    if (this.reminderTimer) clearInterval(this.reminderTimer);
  }

  /**
   * Một lần kiểm: gửi thư nhắc cho các đơn tới lúc nhắc mà chưa nhắc cho hạn hiện tại.
   * @param now  bây giờ (test truyền vào để thử giờ khác)
   * @returns    các thư nhắc đã gửi; trước 07:00 hoặc đang có lần kiểm khác thì rỗng
   */
  async checkReminders(now: Date = new Date()): Promise<SentReminder[]> {
    const nowText = toVietnamTime(now);
    if (!isReminderTime(nowText) || this.busy) return [];
    this.busy = true;
    try {
      // Đơn đang có hạn chạy, kèm lịch sử để tính hạn
      const holidays = await this.holidays.holidayDates();
      const forms = await this.prisma.form.findMany({
        where: { status: { in: RUNNING_STATUSES } },
        select: {
          code: true,
          formTypeSnapshot: true,
          dueSoonRemindedFor: true,
          overdueRemindedFor: true,
          events: { select: { action: true, at: true, status: true }, orderBy: [{ at: 'asc' }, { id: 'asc' }] },
        },
        orderBy: { submittedAt: 'asc' },
      });

      // Từng đơn: tới lúc nhắc mà hạn hiện tại chưa nhắc thì gửi, gửi được (hoặc không cần gửi) thì ghi lại
      const sentReminders: SentReminder[] = [];
      for (const form of forms) {
        const history = form.events.map((formEvent) => ({ action: formEvent.action, at: toVietnamTime(formEvent.at), status: formEvent.status }));
        const maxDays = (form.formTypeSnapshot as unknown as FormType).maxProcessingDays ?? null;
        const reminder = deadlineReminderOf(formDeadline(maxDays, history, nowText, holidays));
        if (!reminder) continue;
        const remindedFor = form[REMINDED_COLUMN[reminder.kind]];
        if (remindedFor && toVietnamTime(remindedFor) === reminder.dueAt) continue;

        const outcome = await this.formEmail.sendReminderEmail(form.code, reminder.kind);
        if (outcome === 'failed') continue;
        await this.prisma.form.update({ where: { code: form.code }, data: { [REMINDED_COLUMN[reminder.kind]]: fromVietnamTime(reminder.dueAt) } });
        if (outcome === 'sent') sentReminders.push({ code: form.code, ...reminder });
      }
      if (sentReminders.length > 0) this.logger.log(`Đã gửi ${sentReminders.length} thư nhắc hạn`);
      return sentReminders;
    } finally {
      this.busy = false;
    }
  }
}
