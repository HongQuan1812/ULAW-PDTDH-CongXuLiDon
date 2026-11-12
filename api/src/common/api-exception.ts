/* Lỗi trả cho người dùng: mã HTTP và câu báo lỗi lấy từ hợp đồng trong shared/ (vd AUTH_MESSAGES[401]). */
import { HttpException } from '@nestjs/common';

export class ApiException extends HttpException {
  /**
   * @param status   mã HTTP, vd 403
   * @param message  câu báo lỗi hiện cho người dùng
   */
  constructor(status: number, message: string) {
    super(message, status);
  }
}
