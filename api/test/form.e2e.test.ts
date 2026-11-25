/* Test nhóm API form: nộp đơn, chi tiết, sửa (kèm tệp). Cần database đã migrate và seed.
   Test nộp đơn thật vào database và tệp thật vào thư mục tạm, rồi xóa sạch đơn đã tạo và trả bộ đếm mã đơn về như cũ khi xong. */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ANSWER_MESSAGES,
  ApiErrorBodySchema,
  FORM_MESSAGES,
  FormDetailSchema,
  FormSummarySchema,
  fileContentPath,
  type RoleId,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

const SUBJECT_ROW = ['Luật Hiến pháp', 3, 'Hiến pháp học', '3 TC', 8];

describe('form (nộp, chi tiết, sửa)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  let counterBackup: { prefix: string; year: number; version: number; last: number }[];
  const createdCodes: string[] = [];
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  /** Câu trả lời hợp lệ của loại đơn xmr: một dòng học phần, cơ sở đào tạo và các tệp minh chứng (tên là id tạm). */
  const answersOf = (tempFileIds: string[]) => ({
    'hoc-phan': [SUBJECT_ROW],
    'co-so-dao-tao': 'ĐH Kinh tế – Luật',
    'hinh-thuc-dao-tao': 'Chính quy',
    'minh-chung': tempFileIds.map((id) => ({ id, name: `${id}.pdf`, sizeBytes: 1 })),
  });

  /** Gửi nộp đơn xmr: phần chữ JSON và các tệp (id tạm → nội dung). */
  function submitXmr(cookie: string, options: { files?: Record<string, string>; body?: object; fileNames?: Record<string, string> } = {}) {
    const files = options.files ?? { 'local-1': 'NOI DUNG 1' };
    const body = options.body ?? { formTypeId: 'xmr', answers: answersOf(Object.keys(files)), committed: true };
    const call = request(server()).post('/api/forms').set('Cookie', cookie).field('request', JSON.stringify(body));
    for (const [tempId, content] of Object.entries(files)) call.attach(tempId, Buffer.from(content), options.fileNames?.[tempId] ?? `${tempId}.pdf`);
    return call;
  }

  /** Nộp đơn hợp lệ và nhớ mã để dọn sau. */
  async function submitOk(cookie: string, files?: Record<string, string>) {
    const summary = FormSummarySchema.parse((await submitXmr(cookie, { files }).expect(201)).body);
    createdCodes.push(summary.code);
    return summary;
  }

  const filesLeftOnDisk = async () => (await readdir(uploadDir)).length;

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'ulaw-form-'));
    process.env['UPLOAD_DIR'] = uploadDir;
    app = await createTestApp();
    prisma = app.get(PrismaService);
    counterBackup = await prisma.formCodeCounter.findMany();
  });

  afterAll(async () => {
    await prisma.form.deleteMany({ where: { code: { in: createdCodes } } });
    await prisma.formCodeCounter.deleteMany();
    await prisma.formCodeCounter.createMany({ data: counterBackup });
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
    delete process.env['UPLOAD_DIR'];
  });

  it('chưa đăng nhập: 401', async () => {
    for (const call of [
      request(server()).post('/api/forms'),
      request(server()).get('/api/forms/XMR-2026-001-00001'),
      request(server()).put('/api/forms/XMR-2026-001-00001'),
    ]) {
      expect(ApiErrorBodySchema.parse((await call.expect(401)).body).message).toBe(FORM_MESSAGES[401]);
    }
  });

  it('nộp đơn: sinh mã tăng dần, lưu bản chụp, tệp (tên có dấu); chi tiết và bảng thấy đơn mới', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const before = await prisma.form.count({ where: { code: { startsWith: 'XMR-' } } });
    const highest = (await prisma.formCodeCounter.aggregate({ where: { prefix: 'XMR' }, _max: { last: true } }))._max.last ?? 0;

    const summary = FormSummarySchema.parse((await submitXmr(cookie, { fileNames: { 'local-1': 'Bảng điểm.pdf' } }).expect(201)).body);
    createdCodes.push(summary.code);
    const year = new Date(Date.now() + 7 * 3_600_000).getUTCFullYear();
    expect(summary).toMatchObject({ formTypeId: 'xmr', formTypeName: 'Xét miễn học phần, chuyển đổi tín chỉ (đã học ở cơ sở đào tạo khác)', status: 'nop' });
    expect(summary.code).toBe(`XMR-${year}-001-${String(highest + 1).padStart(5, '0')}`);
    expect(await prisma.form.count({ where: { code: { startsWith: 'XMR-' } } })).toBe(before + 1);

    // Chi tiết: tệp có id mới ở máy chủ, tên có dấu giữ nguyên, nội dung xem được qua API files
    const detail = FormDetailSchema.parse((await request(server()).get(`/api/forms/${summary.code}`).set('Cookie', cookie).expect(200)).body);
    const savedFile = (detail.answers['minh-chung'] as { id: string; name: string; sizeBytes: number }[])[0]!;
    expect(savedFile).toMatchObject({ name: 'Bảng điểm.pdf', sizeBytes: 'NOI DUNG 1'.length });
    expect(savedFile.id).toMatch(/^file-/);
    expect(detail).toMatchObject({ status: 'nop', receiver: null, handler: null, note: '' });
    expect(detail.sections.length).toBeGreaterThan(0);
    const content = await request(server()).get(`/api${fileContentPath(savedFile.id)}`).set('Cookie', cookie).buffer(true).expect(200);
    expect(content.body.toString()).toBe('NOI DUNG 1');

    // Đơn hiện trong bảng "Đơn đã nộp"
    const mine = await request(server()).get('/api/forms/mine').query({ search: summary.code }).set('Cookie', cookie).expect(200);
    expect(mine.body.forms.map((form: { code: string }) => form.code)).toEqual([summary.code]);
  });

  it('nộp nhiều đơn cùng lúc: mã không trùng, liên tiếp', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const summaries = await Promise.all([1, 2, 3, 4].map(() => submitOk(cookie)));
    const sequences = summaries.map((summary) => Number(summary.code.slice(-5))).sort((a, b) => a - b);
    expect(new Set(sequences).size).toBe(4);
    expect(sequences[3]! - sequences[0]!).toBe(3);
  });

  it('nộp đơn sai: 422 (không lưu đơn, không để lại tệp), 404 loại đơn không nhận', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const formsBefore = await prisma.form.count();
    const filesBefore = await filesLeftOnDisk();
    const messageOf = async (call: request.Test, status: number) => ApiErrorBodySchema.parse((await call.expect(status)).body).message;
    const valid = { formTypeId: 'xmr', answers: answersOf(['local-1']), committed: true };

    // Body hỏng, thiếu phần chữ
    expect(await messageOf(request(server()).post('/api/forms').set('Cookie', cookie).field('request', '{hỏng'), 422)).toBe(FORM_MESSAGES.invalidBody);
    expect(await messageOf(request(server()).post('/api/forms').set('Cookie', cookie), 422)).toBe(FORM_MESSAGES.invalidBody);
    // Chưa cam đoan, thiếu câu trả lời bắt buộc, tệp thiếu / thừa / sai đuôi
    expect(await messageOf(submitXmr(cookie, { body: { ...valid, committed: false } }), 422)).toBe(ANSWER_MESSAGES.commitmentRequired);
    expect(await messageOf(submitXmr(cookie, { body: { ...valid, answers: { ...valid.answers, 'hoc-phan': [] } } }), 422)).toContain('Học phần xin miễn');
    expect(await messageOf(submitXmr(cookie, { files: {}, body: valid }), 422)).toBe(ANSWER_MESSAGES.fileMissing('local-1.pdf'));
    expect(await messageOf(submitXmr(cookie, { files: { 'local-1': 'a', 'local-2': 'b' }, body: valid }), 422)).toBe(ANSWER_MESSAGES.unexpectedFiles);
    expect((await messageOf(submitXmr(cookie, { fileNames: { 'local-1': 'virus.exe' } }), 422))).toContain('virus.exe');
    // Loại đơn không có
    expect(await messageOf(submitXmr(cookie, { body: { ...valid, formTypeId: 'khong-co' } }), 404)).toBe(FORM_MESSAGES.formTypeClosed);

    expect(await prisma.form.count()).toBe(formsBefore);
    expect(await filesLeftOnDisk()).toBe(filesBefore);
  });

  it('nộp thay: cần quyền submitForApplicant, người nộp phải có', async () => {
    const applicantCookie = await loginAs('nguoiNopDon');
    const applicantId = (await request(server()).get('/api/auth/me').set('Cookie', applicantCookie).expect(200)).body.user.id as string;
    const body = { formTypeId: 'xmr', answers: answersOf(['local-1']), committed: true, applicantId };

    // Không có quyền thì 403
    const forbidden = await submitXmr(applicantCookie, { body: { ...body, applicantId: 'cb-1' } }).expect(403);
    expect(forbidden.body.message).toBe(FORM_MESSAGES.submitForApplicantForbidden);

    // Admin nộp thay: đơn thuộc về người nộp, lịch sử ghi admin là người nộp; không có người đó thì 404
    const adminCookie = await loginAs('admin');
    const summary = FormSummarySchema.parse((await submitXmr(adminCookie, { body }).expect(201)).body);
    createdCodes.push(summary.code);
    expect(await prisma.form.findUniqueOrThrow({ where: { code: summary.code } })).toMatchObject({ ownerId: applicantId });
    expect(await prisma.formEvent.findMany({ where: { formCode: summary.code } })).toMatchObject([{ action: 'submit', status: 'nop', actorId: 'cb-3' }]);
    expect((await submitXmr(adminCookie, { body: { ...body, applicantId: 'khong-co' } }).expect(404)).body.message).toBe(FORM_MESSAGES.applicantNotFound);
  });

  it('chi tiết: người nộp chỉ xem đơn của mình (đơn người khác 404), cán bộ viewAll xem được', async () => {
    const applicantCookie = await loginAs('nguoiNopDon');
    const myId = (await request(server()).get('/api/auth/me').set('Cookie', applicantCookie).expect(200)).body.user.id as string;
    const others = await prisma.form.findFirstOrThrow({ where: { ownerId: { not: myId } } });

    const hidden = await request(server()).get(`/api/forms/${others.code}`).set('Cookie', applicantCookie).expect(404);
    expect(hidden.body.message).toBe(FORM_MESSAGES.notFound);
    await request(server()).get('/api/forms/XMR-khong-co').set('Cookie', applicantCookie).expect(404);

    const staffCookie = await loginAs('nguoiXuLiDon');
    const detail = FormDetailSchema.parse((await request(server()).get(`/api/forms/${others.code}`).set('Cookie', staffCookie).expect(200)).body);
    expect(detail.code).toBe(others.code);
  });

  it('sửa đơn: thay tệp thì tệp cũ bị xóa hẳn; Cần bổ sung thành Đã bổ sung; đã tiếp nhận thì 409', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const summary = await submitOk(cookie);
    const put = (body: object, files: Record<string, string> = {}) => {
      const call = request(server()).put(`/api/forms/${summary.code}`).set('Cookie', cookie).field('request', JSON.stringify(body));
      for (const [tempId, content] of Object.entries(files)) call.attach(tempId, Buffer.from(content), `${tempId}.pdf`);
      return call;
    };
    const oldFile = ((await prisma.form.findUniqueOrThrow({ where: { code: summary.code } })).answers as { 'minh-chung': { id: string }[] })['minh-chung'][0]!;
    const filesBefore = await filesLeftOnDisk();

    // Thay tệp cũ bằng tệp mới: giữ nguyên trạng thái Đã nộp
    const edited = FormDetailSchema.parse((await put({ answers: answersOf(['local-9']), committed: true }, { 'local-9': 'NOI DUNG MOI' }).expect(200)).body);
    const newFile = (edited.answers['minh-chung'] as { id: string }[])[0]!;
    expect(newFile.id).not.toBe(oldFile.id);
    expect(edited.status).toBe('nop');
    expect(await filesLeftOnDisk()).toBe(filesBefore);
    await request(server()).get(`/api${fileContentPath(oldFile.id)}`).set('Cookie', cookie).expect(404);
    const content = await request(server()).get(`/api${fileContentPath(newFile.id)}`).set('Cookie', cookie).buffer(true).expect(200);
    expect(content.body.toString()).toBe('NOI DUNG MOI');

    // Giữ nguyên tệp (gửi lại id ở máy chủ, không kèm nội dung) và sửa câu trả lời khác; Cần bổ sung → Đã bổ sung
    await prisma.form.update({ where: { code: summary.code }, data: { status: 'bs' } });
    const keepFile = { ...answersOf([]), 'hoc-phan': [['Luật Dân sự', 4, 'Dân luật', '4 TC', 9]], 'minh-chung': [{ id: newFile.id, name: 'local-9.pdf', sizeBytes: 12 }] };
    const supplemented = FormDetailSchema.parse((await put({ answers: keepFile, committed: true }).expect(200)).body);
    expect(supplemented.status).toBe('bsg');
    expect(supplemented.answers['hoc-phan']).toEqual(keepFile['hoc-phan']);
    await request(server()).get(`/api${fileContentPath(newFile.id)}`).set('Cookie', cookie).expect(200);

    // Sửa sai thì 422 và không đổi gì
    expect((await put({ answers: keepFile, committed: false }).expect(422)).body.message).toBe(ANSWER_MESSAGES.commitmentRequired);
    expect((await put({ nope: 1 }).expect(422)).body.message).toBe(FORM_MESSAGES.invalidBody);

    // Đơn đã tiếp nhận: không sửa được nữa
    await prisma.form.update({ where: { code: summary.code }, data: { status: 'xet' } });
    expect((await put({ answers: keepFile, committed: true }).expect(409)).body.message).toBe(FORM_MESSAGES.notEditable);
  });

  it('sửa đơn: đơn người khác 404 với người nộp; cán bộ không có quyền sửa đơn người khác 403', async () => {
    const applicantCookie = await loginAs('nguoiNopDon');
    const myId = (await request(server()).get('/api/auth/me').set('Cookie', applicantCookie).expect(200)).body.user.id as string;
    const others = await prisma.form.findFirstOrThrow({ where: { ownerId: { not: myId }, status: { in: ['nop', 'bs', 'bsg'] } } });
    const body = { answers: answersOf([]), committed: true };

    const hidden = await request(server()).put(`/api/forms/${others.code}`).set('Cookie', applicantCookie).field('request', JSON.stringify(body)).expect(404);
    expect(hidden.body.message).toBe(FORM_MESSAGES.notFound);

    const staffCookie = await loginAs('nguoiXuLiDon');
    const forbidden = await request(server()).put(`/api/forms/${others.code}`).set('Cookie', staffCookie).field('request', JSON.stringify(body)).expect(403);
    expect(forbidden.body.message).toBe(FORM_MESSAGES.editForbidden);
  });
});
