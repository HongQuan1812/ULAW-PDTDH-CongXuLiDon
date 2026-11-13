/* Thư tự động báo cho người nộp đơn khi đơn chuyển sang một trong bốn lúc gửi: Đã nộp, Cần bổ sung, Từ chối, Đã duyệt.
   Tiêu đề, nội dung theo trang Cấu hình email; lúc gửi đang tắt thì không gửi. Người nhận là email của người nộp đơn.
   Gửi sau khi đơn đã lưu và không chờ: thư lỗi chỉ ghi log, không làm hỏng việc nộp đơn, ra quyết định. */
import { Injectable, Logger } from '@nestjs/common';
import { formEmailTagValues, type EmailEventStatus, type EmailSettings, type FormType } from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';
import { toVietnamTime } from '../common/vietnam-time';
import { AppConfig } from '../config/app-config';
import { buildEmailContent } from './email-content';
import { SETTINGS_ROW_ID } from './email-settings.service';
import { MailSenderService } from './mail-sender.service';

@Injectable()
export class FormEmailService {
  private readonly logger = new Logger(FormEmailService.name);

  /**
   * @param prisma      đọc đơn, cấu hình email
   * @param mailSender  gửi thư
   * @param config      địa chỉ gốc của cổng, địa chỉ nhận thay khi dev
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailSender: MailSenderService,
    private readonly config: AppConfig,
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
   * @returns       true nếu đã gửi; false nếu lúc gửi này đang tắt, không có đơn, chỉ in ra (dev), hoặc gửi lỗi
   */
  async sendStatusEmail(code: string, status: EmailEventStatus): Promise<boolean> {
    // Cấu hình của lúc gửi này; đang tắt thì thôi
    const settingsRow = await this.prisma.emailSettings.findUnique({ where: { id: SETTINGS_ROW_ID } });
    const settings = settingsRow?.settings as unknown as EmailSettings | undefined;
    const event = settings?.events.find((candidate) => candidate.status === status);
    if (!settings || !event?.enabled) return false;

    // Dựng thư từ dữ liệu của đơn
    const form = await this.prisma.form.findUnique({ where: { code }, include: { owner: true, handler: true } });
    if (!form) return false;
    const tagValues = formEmailTagValues(
      {
        applicantName: form.owner.name,
        code: form.code,
        formTypeName: (form.formTypeSnapshot as unknown as FormType).name,
        submittedAt: toVietnamTime(form.submittedAt),
        handlerName: form.handler?.name ?? null,
        note: form.note,
      },
      settings.sender.signature,
      this.config.webBaseUrl,
    );
    const content = buildEmailContent(event.subject, event.body, tagValues);

    /* JUST FOR DEMO: START · Khi dev, người dùng mẫu có email trông như thật: thư gửi về DEV_EMAIL_REDIRECT_TO thay vì người nộp đơn,
       chưa đặt thì chỉ in ra console. Bản thật: gửi thẳng tới form.owner.email. */
    if (this.config.isDev) {
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
