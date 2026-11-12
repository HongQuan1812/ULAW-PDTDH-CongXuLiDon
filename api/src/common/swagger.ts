/* Swagger (OpenAPI): tài liệu API tự sinh, xem ở /api/docs. Schema lấy thẳng từ Zod trong shared/. */
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

/** Đường dẫn trang tài liệu API. */
export const SWAGGER_PATH = 'api/docs';

/**
 * Đổi schema Zod thành schema OpenAPI, để ghi vào @ApiOkResponse({ schema }).
 * @param schema  schema Zod trong shared/, vd HealthResponseSchema
 * @returns       schema OpenAPI 3.0 tương ứng
 */
export function openApiSchemaOf(schema: z.ZodType): SchemaObject {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'output' }) as SchemaObject;
}

/**
 * Bật trang tài liệu API.
 * @param app  ứng dụng NestJS, đã gắn tiền tố /api
 */
export function setUpSwagger(app: INestApplication): void {
  const documentConfig = new DocumentBuilder()
    .setTitle('Cổng xử lí đơn')
    .setDescription('API của Cổng xử lí đơn. Hợp đồng gốc: shared/src/api-contract/.')
    .build();
  SwaggerModule.setup(SWAGGER_PATH, app, () => SwaggerModule.createDocument(app, documentConfig));
}
