/* Test nhóm API profile. Cần database đã migrate và seed. Test sửa hồ sơ của sv-1 rồi trả về như cũ khi xong. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ApiErrorBodySchema,
  FullCccdResponseSchema,
  HandledFormsResponseSchema,
  MAIN_STUDENT_MESSAGES,
  MyFormsResponseSchema,
  PROFILE_MESSAGES,
  ProfileSchema,
  SessionSchema,
  StudentsResponseSchema,
  type RoleId,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

describe('profile', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/dev-login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Trả hồ sơ sv-1 về như seed
    await prisma.user.update({
      where: { id: 'sv-1' },
      data: { name: 'Nguyễn Minh Anh', phone: null, cccd: null, completed: false, mainStudentId: null },
    });
    await app.close();
  });

  it('chưa đăng nhập: 401', async () => {
    const response = await request(server()).get('/api/profile/me').expect(401);
    expect(ApiErrorBodySchema.parse(response.body).message).toBe(PROFILE_MESSAGES[401]);
  });

  it('GET /profile/me trả hồ sơ, CCCD che', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const response = await request(server()).get('/api/profile/me').set('Cookie', cookie).expect(200);
    const profile = ProfileSchema.parse(response.body);
    expect(profile.maskedCccd).toMatch(/•/);
    expect(profile.maskedCccd).not.toBe('079188001122');
  });

  it('GET /profile/me/cccd trả số đầy đủ', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const response = await request(server()).get('/api/profile/me/cccd').set('Cookie', cookie).expect(200);
    expect(FullCccdResponseSchema.parse(response.body).cccd).toBe('079188001122');
  });

  it('GET /profile/me/students: sinh viên có MSSV, MSSV chính là MSSV đầu', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const response = await request(server()).get('/api/profile/me/students').set('Cookie', cookie).expect(200);
    const students = StudentsResponseSchema.parse(response.body);
    expect(students.students.length).toBeGreaterThan(0);
    expect(students.mainStudentId).toBe(students.students[0]!.studentId);
  });

  it('PUT /profile/me/main-student: chọn MSSV của mình được, MSSV lạ thì 422', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const current = StudentsResponseSchema.parse(
      (await request(server()).get('/api/profile/me/students').set('Cookie', cookie)).body,
    );
    const second = current.students[1]!.studentId;
    const saved = await request(server()).put('/api/profile/me/main-student').set('Cookie', cookie).send({ studentId: second }).expect(200);
    expect(StudentsResponseSchema.parse(saved.body).mainStudentId).toBe(second);

    const rejected = await request(server()).put('/api/profile/me/main-student').set('Cookie', cookie).send({ studentId: '000' }).expect(422);
    expect(rejected.body.message).toBe(MAIN_STUDENT_MESSAGES[422]);
  });

  it('PUT /profile/me lưu hồ sơ và trả phiên đã bổ sung thông tin', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const response = await request(server())
      .put('/api/profile/me')
      .set('Cookie', cookie)
      .send({ name: '  Nguyễn Minh Anh Mới ', cccd: '079200001234', phone: '0901234567' })
      .expect(200);
    const session = SessionSchema.parse(response.body);
    expect(session.user.name).toBe('Nguyễn Minh Anh Mới');
    expect(session.profileCompleted).toBe(true);
    const profile = ProfileSchema.parse((await request(server()).get('/api/profile/me').set('Cookie', cookie)).body);
    expect(profile.phone).toBe('0901234567');
  });

  it('PUT /profile/me: CCCD đã thuộc tài khoản khác thì 409', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const response = await request(server())
      .put('/api/profile/me')
      .set('Cookie', cookie)
      .send({ name: 'Nguyễn Minh Anh', cccd: '079188001122', phone: '' })
      .expect(409);
    expect(response.body.message).toBe(PROFILE_MESSAGES[409]);
  });

  it('PUT /profile/me: body sai thì 422', async () => {
    const cookie = await loginAs('nguoiNopDon');
    await request(server()).put('/api/profile/me').set('Cookie', cookie).send({ name: 'A', cccd: '', phone: '' }).expect(422);
  });

  it('hồ sơ người khác: người nộp đơn 403, cán bộ xem được, không có người thì 404', async () => {
    const studentCookie = await loginAs('nguoiNopDon');
    const denied = await request(server()).get('/api/profile/cb-1').set('Cookie', studentCookie).expect(403);
    expect(denied.body.message).toBe(PROFILE_MESSAGES[403]);

    const staffCookie = await loginAs('nguoiXuLiDon');
    const response = await request(server()).get('/api/profile/sv-2').set('Cookie', staffCookie).expect(200);
    expect(ProfileSchema.parse(response.body).role).toBe('nguoiNopDon');
    await request(server()).get('/api/profile/sv-2/cccd').set('Cookie', staffCookie).expect(200);
    await request(server()).get('/api/profile/khong-co').set('Cookie', staffCookie).expect(404);
  });

  it('GET /profile/:userId/forms và /handled-forms trả một trang đúng hợp đồng', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const forms = await request(server()).get('/api/profile/sv-2/forms?page=1&pageSize=5').set('Cookie', cookie).expect(200);
    const parsedForms = MyFormsResponseSchema.parse(forms.body);
    expect(parsedForms.forms.length).toBeLessThanOrEqual(5);
    expect(parsedForms.forms.every((form) => form.submittedAt.length === 16)).toBe(true);

    const handled = await request(server()).get('/api/profile/cb-1/handled-forms').set('Cookie', cookie).expect(200);
    HandledFormsResponseSchema.parse(handled.body);

    await request(server()).get('/api/profile/sv-2/forms?page=abc').set('Cookie', cookie).expect(422);
  });

  it('chọn MSSV chính cho người khác: cán bộ 403, Admin được', async () => {
    const staffCookie = await loginAs('nguoiXuLiDon');
    const denied = await request(server()).put('/api/profile/sv-2/main-student').set('Cookie', staffCookie).send({ studentId: 'x' }).expect(403);
    expect(denied.body.message).toBe(MAIN_STUDENT_MESSAGES[403]);

    const adminCookie = await loginAs('admin');
    const students = StudentsResponseSchema.parse((await request(server()).get('/api/profile/sv-2/students').set('Cookie', adminCookie)).body);
    const studentId = students.students[0]!.studentId;
    await request(server()).put('/api/profile/sv-2/main-student').set('Cookie', adminCookie).send({ studentId }).expect(200);
    const rejected = await request(server()).put('/api/profile/sv-2/main-student').set('Cookie', adminCookie).send({ studentId: '000' }).expect(422);
    expect(rejected.body.message).toBe(MAIN_STUDENT_MESSAGES.personNotOwned);
    await prisma.user.update({ where: { id: 'sv-2' }, data: { mainStudentId: null } });
  });
});
