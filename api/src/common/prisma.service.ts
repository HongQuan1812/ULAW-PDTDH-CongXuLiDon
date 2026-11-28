/* Kết nối database qua Prisma (driver adapter pg, phiên dùng giờ UTC: xem database-adapter.ts). Một kết nối dùng chung cho cả ứng dụng. */
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { createDatabaseAdapter } from './database-adapter';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  /**
   * Tạo Prisma Client nối tới database trong DATABASE_URL.
   * @param appConfig  cấu hình backend, lấy chuỗi kết nối
   */
  constructor(appConfig: AppConfig) {
    super({ adapter: createDatabaseAdapter(appConfig.databaseUrl) });
  }

  /** Đóng kết nối khi ứng dụng tắt. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
