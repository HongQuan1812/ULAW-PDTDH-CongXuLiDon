/* Tạo ứng dụng NestJS cho test e2e: cùng module, cùng thiết lập như lúc chạy thật, nối database thật (Docker). */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * Dựng ứng dụng để gọi bằng Supertest.
 * @returns  ứng dụng đã init, chưa listen; nhớ gọi app.close() sau khi test xong
 */
export async function createTestApp(): Promise<INestApplication> {
  const testingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = testingModule.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}
