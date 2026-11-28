/* Bộ hẹn giờ mở / đóng loại đơn: mỗi phút gọi FormTypesService.runDueSchedules (tới giờ thì đổi trạng thái phiên bản, đánh dấu đã chạy).
   Dấu đã chạy lưu ở database nên restart không chạy lại; máy chủ tắt qua giờ hẹn thì lần kiểm đầu sau khi bật chạy bù. */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { FormTypesService, type ScheduleRun } from './form-types.service';

/** Kiểm mỗi phút (giờ hẹn tính tới phút). */
const SCHEDULE_CHECK_MS = 60_000;

@Injectable()
export class FormTypeScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FormTypeScheduleService.name);
  /** Bộ hẹn giờ kiểm giờ mở / đóng. */
  private scheduleTimer: NodeJS.Timeout | null = null;
  /** Đang có lần kiểm chạy (lần sau tới khi lần trước chưa xong thì bỏ qua). */
  private busy = false;

  /** @param formTypes  chạy các giờ hẹn đã tới */
  constructor(private readonly formTypes: FormTypesService) {}

  /** Bật backend: bắt đầu kiểm mỗi phút. */
  onModuleInit(): void {
    this.scheduleTimer = setInterval(() => {
      this.checkSchedules().catch((error: unknown) => this.logger.error(`Kiểm giờ mở / đóng loại đơn lỗi: ${(error as Error).message}`));
    }, SCHEDULE_CHECK_MS);
  }

  /** Tắt backend: dừng kiểm. */
  onModuleDestroy(): void {
    if (this.scheduleTimer) clearInterval(this.scheduleTimer);
  }

  /**
   * Một lần kiểm.
   * @param now  bây giờ (test truyền vào để thử giờ khác)
   * @returns    các việc đã chạy; đang có lần kiểm khác thì rỗng
   */
  async checkSchedules(now: Date = new Date()): Promise<ScheduleRun[]> {
    if (this.busy) return [];
    this.busy = true;
    try {
      return await this.formTypes.runDueSchedules(now);
    } finally {
      this.busy = false;
    }
  }
}
