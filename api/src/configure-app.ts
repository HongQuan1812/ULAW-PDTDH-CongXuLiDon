/* Các thiết lập chung của ứng dụng, dùng cho cả lúc chạy (main.ts) và lúc test. */
import type { INestApplication } from '@nestjs/common';
import { ApiErrorFilter } from './common/api-error.filter';
import { setUpSwagger } from './common/swagger';
import { AppConfig } from './config/app-config';

/** Tiền tố của mọi đường dẫn API, giống API giả: /api/... */
const API_PREFIX = 'api';

/**
 * Gắn tiền tố /api, lọc lỗi, và Swagger (chỉ khi APP_ENV = "dev").
 * @param app  ứng dụng NestJS vừa tạo, chưa listen
 */
export function configureApp(app: INestApplication): void {
  // Mọi đường dẫn bắt đầu bằng /api; mọi lỗi trả về dạng { message }
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new ApiErrorFilter());

  // Tài liệu API chỉ mở khi phát triển
  if (app.get(AppConfig).isDev) setUpSwagger(app);
}
