/* Nhóm API email: Cấu hình email (xem, lưu, gửi thư thử). Mọi lệnh cần quyền manageEmail. */
import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  EMAIL_ENDPOINTS,
  EMAIL_MESSAGES,
  EmailSettingsResponseSchema,
  EmailSettingsSchema,
  SendTestEmailRequestSchema,
  SendTestEmailResponseSchema,
  type EmailSettingsResponse,
  type SendTestEmailResponse,
} from '@ulaw/shared';
import type { ZodType } from 'zod';
import { CurrentUser, RequirePermission } from '../auth/require-permission.decorator';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import type { User } from '../generated/prisma/client';
import { EmailSettingsService } from './email-settings.service';

/**
 * Kiểm tra body theo schema, giống API giả.
 * @param requestBody  body chưa kiểm tra
 * @param schema       schema cần khớp
 * @returns            body đã kiểm tra
 * @throws             422 kèm câu báo của ô đầu tiên bị sai (không có thì câu chung)
 */
function parseOrReject<Output>(requestBody: unknown, schema: ZodType<Output>): Output {
  const parsed = schema.safeParse(requestBody);
  if (parsed.success) return parsed.data;
  throw new ApiException(422, parsed.error.issues[0]?.message ?? EMAIL_MESSAGES[422]);
}

@ApiTags('email')
@Controller()
@RequirePermission('manageEmail', EMAIL_MESSAGES[403])
export class EmailSettingsController {
  /** @param emailSettingsService  đọc, lưu cấu hình, gửi thư thử */
  constructor(private readonly emailSettingsService: EmailSettingsService) {}

  /** Cấu hình đang dùng, kèm địa chỉ gửi và máy chủ thư đã kết nối chưa. */
  @Get(EMAIL_ENDPOINTS.settings)
  @ApiOkResponse({ schema: openApiSchemaOf(EmailSettingsResponseSchema) })
  get(): Promise<EmailSettingsResponse> {
    return this.emailSettingsService.getSettings();
  }

  /**
   * Lưu cả cấu hình trong một lần.
   * @throws  422 sai dạng, thiếu ô bắt buộc
   */
  @Put(EMAIL_ENDPOINTS.settings)
  @ApiOkResponse({ schema: openApiSchemaOf(EmailSettingsResponseSchema) })
  save(@CurrentUser() editor: User, @Body() requestBody: unknown): Promise<EmailSettingsResponse> {
    return this.emailSettingsService.saveSettings(parseOrReject(requestBody, EmailSettingsSchema), editor);
  }

  /**
   * Gửi một thư thử theo bản đang soạn (chưa cần lưu).
   * @throws  422 sai dạng, địa chỉ nhận sai · 503 chưa kết nối được máy chủ thư
   */
  @Post(EMAIL_ENDPOINTS.test)
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchemaOf(SendTestEmailResponseSchema) })
  sendTest(@Body() requestBody: unknown): Promise<SendTestEmailResponse> {
    return this.emailSettingsService.sendTestEmail(parseOrReject(requestBody, SendTestEmailRequestSchema));
  }
}
