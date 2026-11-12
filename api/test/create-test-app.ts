/* Tạo ứng dụng NestJS cho test e2e: cùng module, cùng thiết lập như lúc chạy thật, nối database thật (Docker). */
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * Dựng ứng dụng để gọi bằng Supertest.
 * @param extraControllers  controller chỉ dùng trong test (vd route mẫu để thử guard quyền)
 * @returns  ứng dụng đã init, chưa listen; nhớ gọi app.close() sau khi test xong
 */
export async function createTestApp(extraControllers: Type<unknown>[] = []): Promise<INestApplication> {
  const testingModule = await Test.createTestingModule({ imports: [AppModule], controllers: extraControllers }).compile();
  const app = testingModule.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}
