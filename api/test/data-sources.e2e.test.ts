/* Test nhóm API Nguồn dữ liệu: quyền, dạng câu trả. Không phụ thuộc database trường có tới được hay không:
   chỉ kiểm tra câu trả khớp hợp đồng và không lộ mật khẩu. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DATA_SOURCE_ENDPOINTS, DATA_SOURCE_MESSAGES, DataSourcesResponseSchema, type RoleId } from '@ulaw/shared';
import { createTestApp } from './create-test-app';

describe('data-sources', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();
  const url = `/api${DATA_SOURCE_ENDPOINTS.list}`;

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('chưa đăng nhập: 401', async () => {
    await request(server()).get(url).expect(401);
  });

  it('người nộp đơn, người xử lí đơn (không có quyền manageDataSources): 403', async () => {
    for (const role of ['nguoiNopDon', 'nguoiXuLiDon'] as const) {
      const response = await request(server()).get(url).set('Cookie', await loginAs(role)).expect(403);
      expect(response.body.message).toBe(DATA_SOURCE_MESSAGES[403]);
    }
  });

  it('Admin: cấu hình và tình trạng database trường đúng hợp đồng, không có mật khẩu', async () => {
    const response = await request(server()).get(url).set('Cookie', await loginAs('admin')).expect(200);
    const { schoolDatabase } = DataSourcesResponseSchema.parse(response.body);

    expect(schoolDatabase.database).toBe('CoreUis');
    // Đã kết nối thì không có lí do lỗi và có thời gian phản hồi; chưa kết nối thì ngược lại
    expect(schoolDatabase.problem === null).toBe(schoolDatabase.connected);
    expect(schoolDatabase.latencyMs === null).toBe(!schoolDatabase.connected);
    if (!schoolDatabase.host) expect(schoolDatabase.problem).toBe('notConfigured');
    // test chạy bản giả (test/setup-env.ts): trang hồ sơ dùng bảng mẫu
    expect(schoolDatabase.usesSampleData).toBe(true);

    const password = process.env['SCHOOL_DB_PASSWORD'];
    if (password) expect(JSON.stringify(response.body)).not.toContain(password);
  });
});
