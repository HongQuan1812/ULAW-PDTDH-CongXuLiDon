/* Bắt mọi lỗi và trả về đúng dạng ApiErrorBody { message } như API giả, để giao diện báo lỗi giống nhau. */
import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { COMMON_MESSAGES, type ApiErrorBody } from '@ulaw/shared';
import { ApiException } from './api-exception';

/** Câu báo cho lỗi do NestJS / Express tự sinh (không phải ApiException), theo mã HTTP. */
const FRAMEWORK_MESSAGES: Record<number, string> = {
  400: 'Dữ liệu gửi lên không đọc được.',
  404: 'Không có API này.',
  413: 'Dữ liệu gửi lên quá lớn.',
};

/** Câu báo cho lỗi 4xx khác do NestJS / Express tự sinh. */
const FRAMEWORK_FALLBACK_MESSAGE = 'Yêu cầu không hợp lệ.';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  /**
   * Chuyển một lỗi thành response JSON.
   * @param exception  lỗi bị ném ra ở controller, service, pipe, guard…
   * @param host       ngữ cảnh request, để lấy response của Express
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message } = this.describe(exception);
    response.status(status).json({ message } satisfies ApiErrorBody);
  }

  /**
   * Chọn mã HTTP và câu báo lỗi cho một lỗi.
   * @param exception  lỗi bị ném ra
   * @returns          ApiException: giữ nguyên · lỗi 4xx của NestJS: câu báo chung theo mã · lỗi khác: 500, ghi log
   */
  private describe(exception: unknown): { status: number; message: string } {
    // Lỗi do mình ném, câu báo đã lấy từ hợp đồng
    if (exception instanceof ApiException) return { status: exception.getStatus(), message: exception.message };

    // Lỗi 4xx do NestJS / Express tự sinh (sai đường dẫn, JSON hỏng…)
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      const status = exception.getStatus();
      return { status, message: FRAMEWORK_MESSAGES[status] ?? FRAMEWORK_FALLBACK_MESSAGE };
    }

    // Lỗi bất ngờ (mất kết nối database, lỗi trong code…): ghi log để tìm nguyên nhân, người dùng chỉ thấy câu chung
    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    return { status: 500, message: COMMON_MESSAGES[500] };
  }
}
