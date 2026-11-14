/* Test nhóm API files. Cần database đã migrate và seed. Test tạo một tệp thật trong thư mục tạm, gắn vào một đơn có sẵn rồi xóa sạch khi xong. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ApiErrorBodySchema, FILE_MESSAGES, SEED_FILE_ID_PREFIX, fileContentPath, type RoleId } from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

const REAL_FILE_ID = 'file-test-real';
const ESCAPING_FILE_ID = 'file-test-escaping';
const MISSING_FILE_ID = 'file-test-missing';

describe('files', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  let applicantFileId: string;
  let othersFileId: string;
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau (đăng nhập thử luôn vào tài khoản mẫu đầu tiên của vai trò). */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  const cleanUp = () => prisma.fileObject.deleteMany({ where: { id: { in: [REAL_FILE_ID, ESCAPING_FILE_ID, MISSING_FILE_ID] } } });

  beforeAll(async () => {
    // Thư mục tệp riêng của test, đặt trước khi dựng ứng dụng (AppConfig đọc lúc khởi tạo)
    uploadDir = await mkdtemp(join(tmpdir(), 'ulaw-files-'));
    process.env['UPLOAD_DIR'] = uploadDir;
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanUp();

    // Người nộp đơn đăng nhập thử: lấy một đơn của họ để gắn tệp thử, và một tệp mẫu của người khác
    const me = await request(server()).get('/api/auth/me').set('Cookie', await loginAs('nguoiNopDon')).expect(200);
    const myId = me.body.user.id as string;
    const mine = await prisma.fileObject.findFirstOrThrow({ where: { id: { startsWith: SEED_FILE_ID_PREFIX }, form: { ownerId: myId } } });
    const formCode = mine.formCode!;
    applicantFileId = mine.id;
    othersFileId = (await prisma.fileObject.findFirstOrThrow({ where: { id: { startsWith: SEED_FILE_ID_PREFIX }, form: { ownerId: { not: myId } } } })).id;

    // Tệp thật trên ổ đĩa, tệp có đường dẫn chui ra ngoài thư mục, tệp mất nội dung
    await writeFile(join(uploadDir, 'real.pdf'), 'NOI DUNG THAT');
    const now = new Date();
    await prisma.fileObject.createMany({
      data: [
        { id: REAL_FILE_ID, formCode, name: 'Bảng điểm.pdf', sizeBytes: 13, storagePath: 'real.pdf', uploadedAt: now },
        { id: ESCAPING_FILE_ID, formCode, name: 'x.pdf', sizeBytes: 1, storagePath: '../real.pdf', uploadedAt: now },
        { id: MISSING_FILE_ID, formCode, name: 'y.pdf', sizeBytes: 1, storagePath: 'khong-co.pdf', uploadedAt: now },
      ],
    });
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
    delete process.env['UPLOAD_DIR'];
  });

  it('chưa đăng nhập: 401', async () => {
    const response = await request(server()).get(`/api${fileContentPath(REAL_FILE_ID)}`).expect(401);
    expect(ApiErrorBodySchema.parse(response.body).message).toBe(FILE_MESSAGES[401]);
  });

  it('người nộp đơn chứa tệp xem được: đúng nội dung, kiểu tệp và tên tệp', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const response = await request(server()).get(`/api${fileContentPath(REAL_FILE_ID)}`).set('Cookie', cookie).buffer(true).expect(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe(`inline; filename*=UTF-8''${encodeURIComponent('Bảng điểm.pdf')}`);
    expect(response.body.toString()).toBe('NOI DUNG THAT');
  });

  it('người nộp đơn khác chủ tệp: 404, câu báo không lộ tệp có tồn tại hay không; cán bộ viewAll thì xem được', async () => {
    const applicantCookie = await loginAs('nguoiNopDon');
    const response = await request(server()).get(`/api${fileContentPath(othersFileId)}`).set('Cookie', applicantCookie).expect(404);
    expect(ApiErrorBodySchema.parse(response.body).message).toBe(FILE_MESSAGES.notFound);

    const staffCookie = await loginAs('nguoiXuLiDon');
    await request(server()).get(`/api${fileContentPath(othersFileId)}`).set('Cookie', staffCookie).expect(200);
    await request(server()).get(`/api${fileContentPath(REAL_FILE_ID)}`).set('Cookie', staffCookie).expect(200);
  });

  it('tệp không có, đường dẫn chui ra ngoài thư mục, hoặc mất trên ổ đĩa: 404', async () => {
    const cookie = await loginAs('admin');
    for (const fileId of ['khong-co', ESCAPING_FILE_ID, MISSING_FILE_ID]) {
      const response = await request(server()).get(`/api${fileContentPath(fileId)}`).set('Cookie', cookie).expect(404);
      expect(ApiErrorBodySchema.parse(response.body).message).toBe(FILE_MESSAGES.notFound);
    }
  });

  it('tệp mẫu của seed (chưa có nội dung thật): trả PDF mẫu ghi tên tệp', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const response = await request(server()).get(`/api${fileContentPath(applicantFileId)}`).set('Cookie', cookie).buffer(true).expect(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.body.toString('latin1').startsWith('%PDF-1.4')).toBe(true);
  });
});
