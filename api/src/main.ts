/* Điểm khởi động backend. */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SWAGGER_PATH } from './common/swagger';
import { AppConfig } from './config/app-config';
import { loadDevEnvFile } from './config/env-file';
import { configureApp } from './configure-app';

/**
 * Tạo ứng dụng NestJS và nghe ở cổng API_PORT.
 * @returns  Promise xong khi máy chủ đã sẵn sàng nhận request
 */
async function bootstrap(): Promise<void> {
  // Đọc .env.dev (chạy thẳng trên máy) trước khi tạo ứng dụng, để AppConfig thấy các biến
  loadDevEnvFile();

  // Tạo ứng dụng, gắn các thiết lập chung rồi nghe
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  const { port, isDev } = app.get(AppConfig);
  await app.listen(port);

  // Báo địa chỉ để mở
  const docsNote = isDev ? ` · tài liệu API: http://localhost:${port}/${SWAGGER_PATH}` : '';
  Logger.log(`Backend chạy ở http://localhost:${port}/api${docsNote}`, 'Bootstrap');
}

void bootstrap();
