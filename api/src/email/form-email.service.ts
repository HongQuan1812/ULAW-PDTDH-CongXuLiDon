/* Thư tự động về một lá đơn, tiêu đề, nội dung theo trang Cấu hình email; lúc gửi đang tắt thì không gửi.
   - Thư cho sinh viên (Đã nộp, Cần bổ sung, Từ chối, Đã duyệt): gửi người nộp đơn.
   - Thư Được chuyển giao: gửi người nhận đơn (người xử lí mới).
   - Thư nhắc Sắp tới hạn, Quá hạn: gửi người xử lí; đơn chưa tiếp nhận (chưa có người xử lí) thì gửi mọi Admin.
   Thư gửi sau khi đơn đã lưu: thư lỗi chỉ ghi log, không làm hỏng việc nộp đơn, ra quyết định, chuyển giao. */
import { Injectable, Logger } from '@nestjs/common';
import { formDeadline, formEmailTagValues, type DeadlineReminderKind, type EmailEventKind, type EmailEventStatus, type FormType } from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';
import { toVietnamTime } from '../common/vietnam-time';
import { AppConfig } from '../config/app-config';
import { buildEmailContent, type EmailContent } from './email-content';
import { HolidaysService } from '../holidays/holidays.service';
import { readStoredEmailSettings, SETTINGS_ROW_ID } from './email-settings.service';
import { MailSenderService } from './mail-sender.service';

/** Kết quả gửi một thư: đã gửi · không cần gửi (lúc gửi đang tắt, không có đơn, không có người nhận, chỉ in ra) · gửi lỗi. */
export type FormEmailOutcome = 'sent' | 'skipped' | 'failed';

/** Thư đã dựng xong, chờ gửi. */
interface PreparedFormEmail {
  content: EmailContent;
  senderName: string;
}

@Injectable()
export class FormEmailService {
  private readonly logger = new Logger(FormEmailService.name);

  /**
   * @param prisma      đọc đơn, cấu hình email, Admin
   * @param mailSender  gửi thư
   * @param config      địa chỉ gốc của cổng; bản giả hay thật, địa chỉ nhận thay của bản giả dev-email
   * @param holidays    ngày nghỉ, để tính hạn xử lí (mã {han_xu_li})
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailSender: MailSenderService,
    private readonly config: AppConfig,
    private readonly holidays: HolidaysService,
  ) {}

  /* ---------- Thư cho sinh viên ---------- */

  /**
   * Báo cho người nộp đơn biết đơn vừa chuyển trạng thái. Không chờ gửi xong, không ném lỗi.
   * @param code    mã đơn
   * @param status  trạng thái đơn vừa chuyển tới (một trong bốn lúc gửi)
   */
  notifyStatusChange(code: string, status: EmailEventStatus): void {
    this.sendStatusEmail(code, status).catch((error: unknown) => {
      this.logger.error(`Gửi thư báo đơn ${code} (${status}) lỗi: ${(error as Error).message}`);
    });
  }

  /**
   * Dựng và gửi thư báo một lần chuyển trạng thái cho người nộp đơn.
   * @param code    mã đơn
   * @param status  trạng thái đơn vừa chuyển tới
   * @returns       true nếu đã gửi; false nếu lúc gửi này đang tắt, không có đơn, chỉ in ra (bản giả dev-email), hoặc gửi lỗi
   */
  async sendStatusEmail(code: string, status: EmailEventStatus): Promise<boolean> {
    const form = await this.prisma.form.findUnique({ where: { code }, include: { owner: true } });
    if (!form) return false;
    return (await this.sendFormEmail(code, status, [form.owner.email])) === 'sent';
  }

  /* ---------- Thư cho cán bộ ---------- */

  /**
   * Báo cho người nhận đơn biết vừa được chuyển giao. Không chờ gửi xong, không ném lỗi.
   * @param code             mã đơn
   * @param transferrerName  họ tên người chuyển giao
   */
  notifyTransfer(code: string, transferrerName: string): void {
    this.sendTransferEmail(code, transferrerName).catch((error: unknown) => {
      this.logger.error(`Gửi thư chuyển giao đơn ${code} lỗi: ${(error as Error).message}`);
    });
  }

  /**
   * Dựng và gửi thư Được chuyển giao cho người xử lí hiện tại của đơn (người vừa nhận).
   * @param code             mã đơn
   * @param transferrerName  họ tên người chuyển giao (mã {nguoi_chuyen_giao})
   * @returns                kết quả gửi
   */
  async sendTransferEmail(code: string, transferrerName: string): Promise<FormEmailOutcome> {
    const form = await this.prisma.form.findUnique({ where: { code }, include: { handler: true } });
    if (!form?.handler) return 'skipped';
    return this.sendFormEmail(code, 'transferred', [form.handler.email], transferrerName);
  }

  /**
   * Dựng và gửi thư nhắc hạn: cho người xử lí; đơn chưa có người xử lí thì cho mọi Admin.
   * @param code  mã đơn
   * @param kind  Sắp tới hạn hay Quá hạn
   * @returns     kết quả gửi (gửi nhiều Admin: một thư lỗi là 'failed')
   */
  async sendReminderEmail(code: string, kind: DeadlineReminderKind): Promise<FormEmailOutcome> {
    const form = await this.prisma.form.findUnique({ where: { code }, include: { handler: true } });
    if (!form) return 'skipped';
    const recipients = form.handler
      ? [form.handler.email]
      : (await this.prisma.user.findMany({ where: { role: 'admin' }, orderBy: { email: 'asc' }, select: { email: true } })).map((admin) => admin.email);
    return this.sendFormEmail(code, kind, recipients);
  }

  /* ---------- Dựng, gửi ---------- */

  /**
   * Dựng thư của một lúc gửi rồi gửi tới từng người nhận.
   * @param code             mã đơn
   * @param kind             lúc gửi
   * @param recipients       địa chỉ người nhận thật
   * @param transferrerName  họ tên người chuyển giao (chỉ thư Được chuyển giao)
   * @returns                kết quả gửi
   */
  private async sendFormEmail(code: string, kind: EmailEventKind, recipients: string[], transferrerName?: string): Promise<FormEmailOutcome> {
    if (recipients.length === 0) return 'skipped';
    const prepared = await this.prepareFormEmail(code, kind, transferrerName);
    if (!prepared) return 'skipped';
    const { content, senderName } = prepared;

    /* JUST FOR DEMO: START · dev-email: người dùng mẫu có email trông như thật, nên thư gửi về DEV_EMAIL_REDIRECT_TO (một thư, dù nhiều người nhận)
       thay vì người nhận thật, chưa đặt thì chỉ in ra console. Bản thật: gửi thẳng tới từng người nhận. */
    if (this.config.usesDemoApi('dev-email')) {
      const recipientText = recipients.join(', ');
      if (!this.config.devEmailRedirectTo) {
        this.logger.log(`Thư tự động (chưa gửi, chưa đặt DEV_EMAIL_REDIRECT_TO) tới ${recipientText}: ${content.subject}\n${content.text}`);
        return 'skipped';
      }
      this.logger.log(`Thư tự động của ${recipientText} gửi thay về ${this.config.devEmailRedirectTo}: ${content.subject}`);
      return (await this.mailSender.send({ ...content, senderName, to: this.config.devEmailRedirectTo })) ? 'sent' : 'failed';
    }
    /* JUST FOR DEMO: END */

    // Gửi tới từng người nhận
    let allSent = true;
    for (const recipient of recipients) {
      if (!(await this.mailSender.send({ ...content, senderName, to: recipient }))) allSent = false;
    }
    return allSent ? 'sent' : 'failed';
  }

  /**
   * Dựng tiêu đề, nội dung thư của một lúc gửi từ cấu hình và dữ liệu đơn.
   * @param code             mã đơn
   * @param kind             lúc gửi
   * @param transferrerName  họ tên người chuyển giao
   * @returns                thư đã dựng; lúc gửi đang tắt, chưa có cấu hình, không có đơn thì null
   */
  private async prepareFormEmail(code: string, kind: EmailEventKind, transferrerName?: string): Promise<PreparedFormEmail | null> {
    // Cấu hình của lúc gửi này; đang tắt thì thôi
    const settingsRow = await this.prisma.emailSettings.findUnique({ where: { id: SETTINGS_ROW_ID } });
    if (!settingsRow) return null;
    const settings = readStoredEmailSettings(settingsRow.settings);
    const event = settings.events.find((candidate) => candidate.kind === kind);
    if (!event?.enabled) return null;

    // Dữ liệu của đơn, hạn xử lí
    const form = await this.prisma.form.findUnique({
      where: { code },
      include: { owner: true, handler: true, events: { select: { action: true, at: true, status: true }, orderBy: [{ at: 'asc' }, { id: 'asc' }] } },
    });
    if (!form) return null;
    const snapshot = form.formTypeSnapshot as unknown as FormType;
    const history = form.events.map((formEvent) => ({ action: formEvent.action, at: toVietnamTime(formEvent.at), status: formEvent.status }));
    // Đơn nộp trước khi có hạn xử lí thì bản chụp không có mục này: coi như không giới hạn
    const deadline = formDeadline(snapshot.maxProcessingDays ?? null, history, toVietnamTime(new Date()), await this.holidays.holidayDates());

    // Điền mã chèn
    const tagValues = formEmailTagValues(
      {
        applicantName: form.owner.name,
        code: form.code,
        formTypeName: snapshot.name,
        submittedAt: toVietnamTime(form.submittedAt),
        handlerName: form.handler?.name ?? null,
        note: form.note,
        deadline,
        transferrerName,
      },
      settings.sender.signature,
      this.config.webBaseUrl,
    );
    return { content: buildEmailContent(event.subject, event.body, tagValues), senderName: settings.sender.name };
  }
}
