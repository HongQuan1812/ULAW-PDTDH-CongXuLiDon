/* Gửi thư qua máy chủ SMTP trong cấu hình (api/.env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD).
   Địa chỉ gửi là SMTP_USER; tên người gửi lấy từ trang Cấu hình email. */
import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfig } from '../config/app-config';
import type { EmailContent } from './email-content';

/** Chờ máy chủ thư tối đa bao lâu (ms) khi kết nối, để trang không treo lúc máy chủ thư không trả lời. */
const SMTP_TIMEOUT_MS = 5000;

/** Một bức thư cần gửi. */
export interface OutgoingEmail extends EmailContent {
  /** tên hiện ở dòng "Từ" */
  senderName: string;
  /** địa chỉ nhận */
  to: string;
}

@Injectable()
export class MailSenderService {
  private readonly logger = new Logger(MailSenderService.name);
  /** null: chưa cấu hình SMTP, không gửi được thư */
  private readonly transporter: Transporter | null;
  /** true: chưa có máy chủ thư, thư chỉ in ra console (APP_ENV=dev) */
  private readonly printOnly: boolean;
  /** Địa chỉ gửi, cũng là địa chỉ nhận thư trả lời. */
  readonly senderAddress: string;

  /**
   * Tạo kết nối tới máy chủ thư theo cấu hình.
   * @param config  cấu hình backend (phần smtp)
   */
  constructor(config: AppConfig) {
    const { host, port, user, password } = config.smtp;
    this.senderAddress = user;

    // Có máy chủ thư: kết nối thật; cổng 465 mã hóa ngay, cổng khác nâng lên bằng STARTTLS
    if (host) {
      this.printOnly = false;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass: password },
        connectionTimeout: SMTP_TIMEOUT_MS,
        greetingTimeout: SMTP_TIMEOUT_MS,
        socketTimeout: SMTP_TIMEOUT_MS,
      });
      return;
    }

    /* JUST FOR DEMO: START · Chưa có máy chủ thư mà APP_ENV=dev: không gửi đi, chỉ dựng thư rồi in ra console để xem.
       Bản thật đặt SMTP_HOST trong api/.env (không đặt thì không gửi được thư nào). */
    this.printOnly = config.isDev;
    this.transporter = this.printOnly ? nodemailer.createTransport({ jsonTransport: true }) : null;
    /* JUST FOR DEMO: END */
  }

  /**
   * Máy chủ thư có kết nối, đăng nhập được không.
   * @returns  true nếu gửi được thư
   */
  async isConnected(): Promise<boolean> {
    if (!this.transporter) return false;
    if (this.printOnly) return true;
    try {
      return await this.transporter.verify();
    } catch (error) {
      this.logger.warn(`Không kết nối được máy chủ thư: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Gửi một bức thư từ địa chỉ gửi.
   * @param email  tên người gửi, người nhận, tiêu đề, nội dung
   * @returns      true nếu máy chủ thư đã nhận thư; false nếu chưa cấu hình hoặc gửi lỗi (lỗi ghi vào log)
   */
  async send(email: OutgoingEmail): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      const info = await this.transporter.sendMail({
        from: { name: email.senderName, address: this.senderAddress },
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      /* JUST FOR DEMO: START · Thư không gửi đi (chưa có máy chủ thư) thì in ra console. Bản thật: bỏ, thư đã gửi qua SMTP. */
      if (this.printOnly) this.logger.log(`Thư (chưa gửi đi, chỉ in ra): ${String((info as { message?: unknown }).message)}`);
      /* JUST FOR DEMO: END */

      return true;
    } catch (error) {
      this.logger.error(`Gửi thư tới ${email.to} lỗi: ${(error as Error).message}`);
      return false;
    }
  }
}
