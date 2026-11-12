/* Test nhóm API health, và cách backend trả lỗi chung. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ApiErrorBodySchema, HealthResponseSchema } from '@ulaw/shared';
import { createTestApp } from './create-test-app';

describe('health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health trả { ok: true } khi nối được database', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(HealthResponseSchema.parse(response.body)).toEqual({ ok: true });
  });

  it('đường dẫn không có trả 404 dạng { message } tiếng Việt', async () => {
    const response = await request(app.getHttpServer()).get('/api/khong-co').expect(404);
    expect(ApiErrorBodySchema.parse(response.body)).toEqual({ message: 'Không có API này.' });
  });
});
