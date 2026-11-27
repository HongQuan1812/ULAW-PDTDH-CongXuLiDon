/* Thư tự động báo cho người nộp đơn khi đơn chuyển sang một trong bốn lúc gửi: Đã nộp, Cần bổ sung, Từ chối, Đã duyệt.
   Tiêu đề, nội dung theo trang Cấu hình email; lúc gửi đang tắt thì không gửi. Người nhận là email của người nộp đơn.
   Gửi sau khi đơn đã lưu và không chờ: thư lỗi chỉ ghi log, không làm hỏng việc nộp đơn, ra quyết định. */
import { Injectable, Logger } from '@nestjs/common';
import { formDeadline, formEmailTagValues, type EmailEventStatus, type FormType } from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';
import { toVietnamTime } from '../common/vietnam-time';
import { AppConfig } from '../config/app-config';
import { buildEmailContent } from './email-content';
import { HolidaysService } from '../holidays/holidays.service';
import { readStoredEmailSettings, SETTINGS_ROW_ID } from './email-settings.service';
import { MailSenderService } from './mail-sender.service';

@Injectable()
export class FormEmailService {
  private readonly logger = new Logger(FormEmailService.name);

  /**
   * @param prisma      đọc đơn, cấu hình email
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
   * Dựng và gửi thư báo một lần chuyển trạng thái.
   * @param code    mã đơn
   * @param status  trạng thái đơn vừa chuyển tới
   * @returns       true nếu đã gửi; false nếu lúc gửi này đang tắt, không có đơn, chỉ in ra (bản giả dev-email), hoặc gửi lỗi
   */
  async sendStatusEmail(code: string, status: EmailEventStatus): Promise<boolean> {
    // Cấu hình của lúc gửi này; đang tắt thì thôi
    const settingsRow = await this.prisma.emailSettings.findUnique({ where: { id: SETTINGS_ROW_ID } });
    if (!settingsRow) return false;
    const settings = readStoredEmailSettings(settingsRow.settings);
    const event = settings.events.find((candidate) => candidate.kind === status);
    if (!event?.enabled) return false;

    // Dựng thư từ dữ liệu của đơn
    const form = await this.prisma.form.findUnique({
      where: { code },
      include: { owner: true, handler: true, events: { select: { action: true, at: true, status: true }, orderBy: [{ at: 'asc' }, { id: 'asc' }] } },
    });
    if (!form) return false;
    const snapshot = form.formTypeSnapshot as unknown as FormType;
    const history = form.events.map((formEvent) => ({ action: formEvent.action, at: toVietnamTime(formEvent.at), status: formEvent.status }));
    // Đơn nộp trước khi có hạn xử lí thì bản chụp không có mục này: coi như không giới hạn
    const deadline = formDeadline(snapshot.maxProcessingDays ?? null, history, toVietnamTime(new Date()), await this.holidays.holidayDates());
    const tagValues = formEmailTagValues(
      {
        applicantName: form.owner.name,
        code: form.code,
        formTypeName: snapshot.name,
        submittedAt: toVietnamTime(form.submittedAt),
        handlerName: form.handler?.name ?? null,
        note: form.note,
        deadline,
      },
      settings.sender.signature,
      this.config.webBaseUrl,
    );
    const content = buildEmailContent(event.subject, event.body, tagValues);

    /* JUST FOR DEMO: START · dev-email: người dùng mẫu có email trông như thật, nên thư gửi về DEV_EMAIL_REDIRECT_TO thay vì người nộp đơn,
       chưa đặt thì chỉ in ra console. Bản thật: gửi thẳng tới form.owner.email. */
    if (this.config.usesDemoApi('dev-email')) {
      if (!this.config.devEmailRedirectTo) {
        this.logger.log(`Thư tự động (chưa gửi, chưa đặt DEV_EMAIL_REDIRECT_TO) tới ${form.owner.email}: ${content.subject}\n${content.text}`);
        return false;
      }
      this.logger.log(`Thư tự động của ${form.owner.email} gửi thay về ${this.config.devEmailRedirectTo}: ${content.subject}`);
      return this.mailSender.send({ ...content, senderName: settings.sender.name, to: this.config.devEmailRedirectTo });
    }
    /* JUST FOR DEMO: END */

    // Gửi tới email của người nộp đơn
    return this.mailSender.send({ ...content, senderName: settings.sender.name, to: form.owner.email });
  }
}
