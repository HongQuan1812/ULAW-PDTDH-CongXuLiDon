/* Test xử lí đơn: tiếp nhận, ra quyết định, chuyển giao. Cần database đã migrate và seed.
   Test nộp đơn thật rồi xử lí, sau đó xóa đơn đã tạo và trả bộ đếm mã đơn về như cũ. */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ApiErrorBodySchema,
  FORM_MESSAGES,
  FormDetailSchema,
  FormSummarySchema,
  TransferTargetsResponseSchema,
  type RoleId,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { FormEmailService } from '../src/email/form-email.service';
import { createTestApp } from './create-test-app';

describe('workflow (tiếp nhận, quyết định, chuyển giao)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  let counterBackup: { prefix: string; year: number; version: number; last: number }[];
  const createdCodes: string[] = [];
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/dev-login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  /** Người nộp đơn nộp một đơn xmm mới, trả mã đơn. */
  async function submitNewForm(applicantCookie: string): Promise<string> {
    const body = {
      formTypeId: 'xmm',
      answers: { mon: [['Luật Hiến pháp', 3, 'Hiến pháp học', 'ĐH Kinh tế – Luật']], files: [{ id: 'local-1', name: 'a.pdf', sizeBytes: 1 }] },
      committed: true,
    };
    const response = await request(server())
      .post('/api/forms')
      .set('Cookie', applicantCookie)
      .field('request', JSON.stringify(body))
      .attach('local-1', Buffer.from('X'), 'a.pdf')
      .expect(201);
    const { code } = FormSummarySchema.parse(response.body);
    createdCodes.push(code);
    return code;
  }

  const post = (cookie: string, path: string, body?: object) => request(server()).post(`/api/forms/${path}`).set('Cookie', cookie).send(body ?? {});
  const messageOf = (response: { body: unknown }) => ApiErrorBodySchema.parse(response.body).message;

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'ulaw-workflow-'));
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

  it('thư báo người nộp đơn: gửi khi nộp và khi ra quyết định; tiếp nhận thì không', async () => {
    const notifySpy = vi.spyOn(app.get(FormEmailService), 'notifyStatusChange').mockImplementation(() => undefined);
    try {
      const code = await submitNewForm(await loginAs('nguoiNopDon'));
      const staff = await loginAs('nguoiXuLiDon');
      await post(staff, `${code}/receive`).expect(200);
      await post(staff, `${code}/decision`, { decision: 'tc', note: 'Không đủ điều kiện' }).expect(200);
      expect(notifySpy.mock.calls).toEqual([
        [code, 'nop'],
        [code, 'tc'],
      ]);
    } finally {
      notifySpy.mockRestore();
    }
  });

  it('chưa đăng nhập: 401', async () => {
    for (const call of [
      request(server()).post('/api/forms/XMM-2026-001-00001/receive'),
      request(server()).post('/api/forms/XMM-2026-001-00001/decision'),
      request(server()).get('/api/forms/XMM-2026-001-00001/transfer-targets'),
      request(server()).post('/api/forms/XMM-2026-001-00001/transfer'),
    ]) {
      expect(messageOf(await call.expect(401))).toBe(FORM_MESSAGES[401]);
    }
  });

  it('người nộp đơn: không có quyền xử lí (403), đơn không có thì 404', async () => {
    const applicant = await loginAs('nguoiNopDon');
    const code = await submitNewForm(applicant);

    expect(messageOf(await post(applicant, `${code}/receive`).expect(403))).toBe(FORM_MESSAGES.receiveForbidden);
    expect(messageOf(await post(applicant, `${code}/decision`, { decision: 'duyet', note: '' }).expect(403))).toBe(FORM_MESSAGES.decideForbidden);
    expect(messageOf(await request(server()).get(`/api/forms/${code}/transfer-targets`).set('Cookie', applicant).expect(403))).toBe(FORM_MESSAGES.transferForbidden);
    expect(messageOf(await post(applicant, `${code}/transfer`, { toStaffId: 'cb-3' }).expect(403))).toBe(FORM_MESSAGES.transferForbidden);

    const staff = await loginAs('nguoiXuLiDon');
    for (const path of ['KHONG-CO/receive', 'KHONG-CO/decision', 'KHONG-CO/transfer']) {
      expect(messageOf(await post(staff, path, { decision: 'duyet', note: '', toStaffId: 'cb-3' }).expect(404))).toBe(FORM_MESSAGES.notFound);
    }
  });

  it('tiếp nhận: Đã nộp → Đang xét, người bấm thành người tiếp nhận và xử lí; tiếp nhận lần hai 409', async () => {
    const code = await submitNewForm(await loginAs('nguoiNopDon'));
    const staff = await loginAs('nguoiXuLiDon');

    const received = FormDetailSchema.parse((await post(staff, `${code}/receive`).expect(200)).body);
    expect(received).toMatchObject({ status: 'xet', note: '', receiver: { id: 'cb-1' }, handler: { id: 'cb-1' } });
    expect(received.receivedAt).not.toBeNull();
    expect(received.handlerSince).toBe(received.receivedAt);

    expect(messageOf(await post(staff, `${code}/receive`).expect(409))).toBe(FORM_MESSAGES.notReceivable);
  });

  it('hai cán bộ tiếp nhận cùng lúc: chỉ một người thành công', async () => {
    const code = await submitNewForm(await loginAs('nguoiNopDon'));
    const staff = await loginAs('nguoiXuLiDon');
    const admin = await loginAs('admin');

    const statuses = (await Promise.all([post(staff, `${code}/receive`), post(admin, `${code}/receive`)])).map((response) => response.status);
    expect(statuses.sort()).toEqual([200, 409]);
  });

  it('ra quyết định: 422 body sai, 409 khi chưa tiếp nhận; bổ sung → người nộp sửa → tiếp nhận lại → duyệt', async () => {
    const applicant = await loginAs('nguoiNopDon');
    const code = await submitNewForm(applicant);
    const staff = await loginAs('nguoiXuLiDon');

    // Chưa tiếp nhận thì chưa ra quyết định được
    expect(messageOf(await post(staff, `${code}/decision`, { decision: 'duyet', note: '' }).expect(409))).toBe(FORM_MESSAGES.notDecidable);
    await post(staff, `${code}/receive`).expect(200);
    expect(messageOf(await post(staff, `${code}/decision`, { decision: 'xoa' }).expect(422))).toBe(FORM_MESSAGES.invalidBody);

    // Yêu cầu bổ sung: lưu lí do (bỏ khoảng trắng đầu cuối), không đổi người xử lí
    const supplement = FormDetailSchema.parse((await post(staff, `${code}/decision`, { decision: 'bs', note: '  Thiếu bảng điểm  ' }).expect(200)).body);
    expect(supplement).toMatchObject({ status: 'bs', note: 'Thiếu bảng điểm', handler: { id: 'cb-1' } });
    expect((await prisma.form.findUniqueOrThrow({ where: { code } })).decidedAt).toBeNull();

    // Người nộp sửa → Đã bổ sung → tiếp nhận lại xóa lí do cũ
    const body = { answers: supplement.answers, committed: true };
    const resent = await request(server()).put(`/api/forms/${code}`).set('Cookie', applicant).field('request', JSON.stringify(body));
    expect(resent.status).toBe(200);
    expect(resent.body.status).toBe('bsg');
    const again = FormDetailSchema.parse((await post(staff, `${code}/receive`).expect(200)).body);
    expect(again).toMatchObject({ status: 'xet', note: '' });

    // Duyệt: lưu lúc quyết định, xóa lí do
    const approved = FormDetailSchema.parse((await post(staff, `${code}/decision`, { decision: 'duyet', note: 'bỏ qua' }).expect(200)).body);
    expect(approved).toMatchObject({ status: 'duyet', note: '' });
    expect((await prisma.form.findUniqueOrThrow({ where: { code } })).decidedAt).not.toBeNull();
    expect(messageOf(await post(staff, `${code}/decision`, { decision: 'tc', note: '' }).expect(409))).toBe(FORM_MESSAGES.notDecidable);
  });

  it('từ chối: lưu lí do; đơn do người khác phụ trách thì chỉ admin (decideAny) quyết định được', async () => {
    const code = await submitNewForm(await loginAs('nguoiNopDon'));
    const staff = await loginAs('nguoiXuLiDon');
    const admin = await loginAs('admin');

    // Admin tiếp nhận nên là người xử lí; cán bộ thường không được quyết định thay
    await post(admin, `${code}/receive`).expect(200);
    const handler = (await prisma.form.findUniqueOrThrow({ where: { code } })).handlerId;
    expect(handler).toBe('cb-3');
    expect(messageOf(await post(staff, `${code}/decision`, { decision: 'tc', note: 'x' }).expect(403))).toBe(FORM_MESSAGES.decideForbidden);

    // Chuyển cho cán bộ thường thì cán bộ đó quyết định được
    await post(admin, `${code}/transfer`, { toStaffId: 'cb-1' }).expect(200);
    const rejected = FormDetailSchema.parse((await post(staff, `${code}/decision`, { decision: 'tc', note: 'Không đủ minh chứng' }).expect(200)).body);
    expect(rejected).toMatchObject({ status: 'tc', note: 'Không đủ minh chứng' });
  });

  it('chuyển giao: danh sách bỏ người đang xử lí; đổi người xử lí, giữ trạng thái và người tiếp nhận; 409 / 422', async () => {
    const code = await submitNewForm(await loginAs('nguoiNopDon'));
    const staff = await loginAs('nguoiXuLiDon');

    // Chưa tiếp nhận thì chưa chuyển giao được
    expect(messageOf(await request(server()).get(`/api/forms/${code}/transfer-targets`).set('Cookie', staff).expect(409))).toBe(FORM_MESSAGES.notTransferable);
    expect(messageOf(await post(staff, `${code}/transfer`, { toStaffId: 'cb-3' }).expect(409))).toBe(FORM_MESSAGES.notTransferable);
    await post(staff, `${code}/receive`).expect(200);

    const targets = TransferTargetsResponseSchema.parse((await request(server()).get(`/api/forms/${code}/transfer-targets`).set('Cookie', staff).expect(200)).body);
    expect(targets.staff.length).toBeGreaterThan(0);
    expect(targets.staff.map((person) => person.id)).not.toContain('cb-1');
    expect(targets.staff.map((person) => person.id)).toContain('cb-3');

    // Người nhận không hợp lệ (chính mình, người nộp đơn, id lạ, body sai)
    const applicantId = (await prisma.form.findUniqueOrThrow({ where: { code } })).ownerId;
    for (const toStaffId of ['cb-1', applicantId, 'khong-co']) {
      expect(messageOf(await post(staff, `${code}/transfer`, { toStaffId }).expect(422))).toBe(FORM_MESSAGES.invalidTransferTarget);
    }
    expect(messageOf(await post(staff, `${code}/transfer`, {}).expect(422))).toBe(FORM_MESSAGES.invalidBody);

    // Chuyển thành công
    const moved = FormDetailSchema.parse((await post(staff, `${code}/transfer`, { toStaffId: 'cb-3' }).expect(200)).body);
    expect(moved).toMatchObject({ status: 'xet', receiver: { id: 'cb-1' }, handler: { id: 'cb-3' } });
    expect(Date.parse(moved.handlerSince!)).toBeGreaterThanOrEqual(Date.parse(moved.receivedAt!));

    // Đã có kết quả thì không chuyển giao được nữa
    const admin = await loginAs('admin');
    await post(admin, `${code}/decision`, { decision: 'duyet', note: '' }).expect(200);
    expect(messageOf(await post(admin, `${code}/transfer`, { toStaffId: 'cb-1' }).expect(409))).toBe(FORM_MESSAGES.notTransferable);
  });
});
