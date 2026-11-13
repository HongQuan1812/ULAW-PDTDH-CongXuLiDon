/* Cấu hình email: đọc, lưu (một dòng duy nhất trong bảng EmailSettings), gửi thư thử bằng dữ liệu mẫu.
   Quyền manageEmail đã được guard kiểm tra ở controller. */
import { Injectable } from '@nestjs/common';
import {
  EMAIL_MESSAGES,
  EMAIL_SAMPLE_VALUES,
  formLink,
  TEST_EMAIL_SUBJECT_PREFIX,
  type EmailSettings,
  type EmailSettingsResponse,
  type SendTestEmailRequest,
  type SendTestEmailResponse,
} from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import { toVietnamTime } from '../common/vietnam-time';
import { AppConfig } from '../config/app-config';
import type { Prisma, User } from '../generated/prisma/client';
import { buildEmailContent } from './email-content';
import { MailSenderService } from './mail-sender.service';

/** Id dòng cấu hình email duy nhất. */
export const SETTINGS_ROW_ID = 1;

/** Lấy kèm cán bộ lưu lần gần nhất. */
const WITH_UPDATED_BY = { updatedBy: { select: { id: true, name: true, email: true } } } as const;

/** Dòng EmailSettings kèm cán bộ lưu lần gần nhất. */
type EmailSettingsRow = Prisma.EmailSettingsGetPayload<{ include: typeof WITH_UPDATED_BY }>;

@Injectable()
export class EmailSettingsService {
  /**
   * @param prisma      truy cập database
   * @param mailSender  gửi thư, cho biết địa chỉ gửi và máy chủ thư đã kết nối chưa
   * @param config      địa chỉ gốc của cổng, để dựng đường dẫn tới đơn trong thư thử
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailSender: MailSenderService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Đổi dòng database sang câu trả, kèm địa chỉ gửi và tình trạng máy chủ thư.
   * @param row  dòng cấu hình kèm cán bộ lưu
   * @returns    theo EmailSettingsResponseSchema
   */
  private async toResponse(row: EmailSettingsRow): Promise<EmailSettingsResponse> {
    return {
      settings: row.settings as unknown as EmailSettings,
      updatedAt: toVietnamTime(row.updatedAt),
      updatedBy: row.updatedBy,
      senderAddress: this.mailSender.senderAddress,
      mailServerConnected: await this.mailSender.isConnected(),
    };
  }

  /**
   * Cấu hình đang dùng.
   * @returns  cấu hình, lần lưu gần nhất, địa chỉ gửi, tình trạng máy chủ thư
   * @throws   lỗi nếu database chưa seed dòng cấu hình (500)
   */
  async getSettings(): Promise<EmailSettingsResponse> {
    const row = await this.prisma.emailSettings.findUniqueOrThrow({ where: { id: SETTINGS_ROW_ID }, include: WITH_UPDATED_BY });
    return this.toResponse(row);
  }

  /**
   * Lưu cả cấu hình (người gửi và bốn lúc gửi), ghi lại lúc lưu và người lưu.
   * @param settings  cấu hình mới (đã kiểm tra bằng EmailSettingsSchema)
   * @param editor    người đang đăng nhập
   * @returns         cấu hình sau khi lưu
   */
  async saveSettings(settings: EmailSettings, editor: User): Promise<EmailSettingsResponse> {
    const savedFields = { settings: settings as unknown as Prisma.InputJsonValue, updatedAt: new Date(), updatedById: editor.id };
    const row = await this.prisma.emailSettings.upsert({
      where: { id: SETTINGS_ROW_ID },
      create: { id: SETTINGS_ROW_ID, ...savedFields },
      update: savedFields,
      include: WITH_UPDATED_BY,
    });
    return this.toResponse(row);
  }

  /**
   * Gửi một thư thử theo bản đang soạn, điền dữ liệu mẫu; tiêu đề có thêm chữ [Thử] ở đầu.
   * Đường dẫn tới đơn dựng theo địa chỉ cổng của môi trường (như thư thật), để bấm thử mở được cổng đang chạy.
   * @param testRequest  địa chỉ nhận, người gửi, tiêu đề, nội dung (đã kiểm tra bằng SendTestEmailRequestSchema)
   * @returns            câu báo đã gửi
   * @throws             503 chưa kết nối được máy chủ thư, hoặc máy chủ thư không nhận thư
   */
  async sendTestEmail(testRequest: SendTestEmailRequest): Promise<SendTestEmailResponse> {
    // Dựng thư bằng dữ liệu mẫu, đường dẫn theo địa chỉ cổng, chữ kí theo bản đang soạn
    const content = buildEmailContent(TEST_EMAIL_SUBJECT_PREFIX + testRequest.subject, testRequest.body, {
      ...EMAIL_SAMPLE_VALUES,
      link_don: formLink(this.config.webBaseUrl, EMAIL_SAMPLE_VALUES.ma_don),
      chu_ki: testRequest.sender.signature,
    });

    // Gửi; máy chủ thư chưa kết nối hoặc không nhận thì báo 503
    const sent = await this.mailSender.send({ ...content, senderName: testRequest.sender.name, to: testRequest.to });
    if (!sent) throw new ApiException(503, EMAIL_MESSAGES.mailServerDown);
    return { message: EMAIL_MESSAGES.testSent(testRequest.to) };
  }
}
