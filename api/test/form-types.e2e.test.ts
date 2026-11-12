/* Test nhóm API form-types. Cần database đã migrate và seed. Test tạo loại đơn có mã đơn ZTT / ZTU rồi xóa sạch khi xong. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ApiErrorBodySchema,
  FORM_TYPE_DRAFT_MESSAGES,
  FORM_TYPE_MESSAGES,
  FormTypeSchema,
  FormTypesResponseSchema,
  ManagedFormTypeSchema,
  OpenFormTypesResponseSchema,
  type RoleId,
  type SaveFormTypeVersionRequest,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

const TEST_PREFIXES = ['ZTT', 'ZTU'];

/** Bản soạn hợp lệ nhỏ nhất: một phần, một câu trả lời ngắn. */
function draftOf(prefix: string, overrides: Partial<SaveFormTypeVersionRequest> = {}): SaveFormTypeVersionRequest {
  return {
    prefix,
    name: 'Loại đơn thử',
    description: null,
    status: 'draft',
    sections: [{ id: 's1', title: 'Phần một', main: true, questions: [{ id: 'q1', type: 'text', label: 'Nội dung thử', required: true }] }],
    ...overrides,
  };
}

describe('form-types', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/dev-login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  /** Xóa các loại đơn thử (xóa kèm phiên bản). */
  const cleanUp = () => prisma.formType.deleteMany({ where: { prefix: { in: TEST_PREFIXES } } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanUp();
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  it('chưa đăng nhập: 401', async () => {
    for (const path of ['/api/form-types', '/api/form-types/open', '/api/form-types/xmm']) {
      const response = await request(server()).get(path).expect(401);
      expect(ApiErrorBodySchema.parse(response.body).message).toBe(FORM_TYPE_MESSAGES[401]);
    }
  });

  it('người nộp đơn: xem được loại đơn đang mở, nhưng 403 ở các lệnh quản lí', async () => {
    const cookie = await loginAs('nguoiNopDon');
    const open = OpenFormTypesResponseSchema.parse((await request(server()).get('/api/form-types/open').set('Cookie', cookie).expect(200)).body);
    expect(open.formTypes.map((formType) => formType.id)).toContain('xmm');

    const detail = FormTypeSchema.parse((await request(server()).get('/api/form-types/xmm').set('Cookie', cookie).expect(200)).body);
    expect(detail.status).toBe('open');
    expect(detail.sections.length).toBeGreaterThan(0);

    for (const call of [
      request(server()).get('/api/form-types').set('Cookie', cookie),
      request(server()).get('/api/form-types/xmm/versions').set('Cookie', cookie),
      request(server()).post('/api/form-types').set('Cookie', cookie).send({}),
      request(server()).post('/api/form-types/xmm/versions').set('Cookie', cookie).send({}),
      request(server()).put('/api/form-types/xmm/versions/1').set('Cookie', cookie).send({}),
      request(server()).delete('/api/form-types/xmm/versions/1').set('Cookie', cookie),
      request(server()).put('/api/form-types/xmm/versions/1/status').set('Cookie', cookie).send({}),
    ]) {
      const response = await call.expect(403);
      expect(ApiErrorBodySchema.parse(response.body).message).toBe(FORM_TYPE_MESSAGES[403]);
    }
  });

  it('GET /form-types trả mỗi loại đơn một dòng, phiên bản cũ nằm trong olderVersions', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const { formTypes } = FormTypesResponseSchema.parse((await request(server()).get('/api/form-types').set('Cookie', cookie).expect(200)).body);
    const xmm = formTypes.find((formType) => formType.id === 'xmm')!;
    expect(xmm.prefix).toBe('XMM');
    expect(xmm.formCount).toBeGreaterThan(0);
    expect(formTypes.some((formType) => formType.olderVersions.length > 0)).toBe(true);
    expect(new Set(formTypes.map((formType) => formType.id)).size).toBe(formTypes.length);
  });

  it('loại đơn không có, hoặc chưa có phiên bản đang mở: 404', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const created = await request(server()).post('/api/form-types').set('Cookie', cookie).send(draftOf('ZTU')).expect(201);
    const { id } = ManagedFormTypeSchema.parse(created.body);

    expect(ApiErrorBodySchema.parse((await request(server()).get(`/api/form-types/${id}`).set('Cookie', cookie).expect(404)).body).message).toBe(FORM_TYPE_MESSAGES[404]);
    await request(server()).get('/api/form-types/khong-co').set('Cookie', cookie).expect(404);
    expect(ApiErrorBodySchema.parse((await request(server()).get('/api/form-types/khong-co/versions').set('Cookie', cookie).expect(404)).body).message).toBe(FORM_TYPE_MESSAGES.notFound);

    // Xóa phiên bản Nháp duy nhất thì xóa luôn loại đơn: 204, rồi không còn nữa
    await request(server()).delete(`/api/form-types/${id}/versions/1`).set('Cookie', cookie).expect(204);
    await request(server()).get(`/api/form-types/${id}/versions`).set('Cookie', cookie).expect(404);
  });

  it('tạo loại đơn: 422 khi sai dạng hoặc chưa hợp lệ, 409 khi trùng mã đơn', async () => {
    const cookie = await loginAs('admin');
    const post = (body: unknown) => request(server()).post('/api/form-types').set('Cookie', cookie).send(body as object);

    expect((await post({ prefix: 'ZTT' }).expect(422)).body.message).toBe(FORM_TYPE_MESSAGES.invalidRequest);
    const blankTitle = draftOf('ZTT', { sections: [{ id: 's1', title: ' ', main: false, questions: [{ id: 'q1', type: 'text', label: 'Nội dung thử', required: false }] }] });
    expect((await post(blankTitle).expect(422)).body.message).toContain('Phần 1: nhập tiêu đề phần.');
    expect((await post(draftOf('abc')).expect(422)).body.message).toBe(FORM_TYPE_DRAFT_MESSAGES.prefixFormat);
    expect((await post(draftOf('XMM')).expect(409)).body.message).toBe(FORM_TYPE_DRAFT_MESSAGES.prefixTaken('XMM'));
  });

  it('vòng đời phiên bản: Nháp → mở → khóa → phiên bản mới → mở / đóng → xóa Nháp', async () => {
    const cookie = await loginAs('nguoiXuLiDon');
    const call = (method: 'post' | 'put' | 'delete', path: string) => request(server())[method](`/api/form-types${path}`).set('Cookie', cookie);

    // Tạo (Nháp), sửa Nháp, đổi mã đơn khi chưa khóa được
    const created = ManagedFormTypeSchema.parse((await call('post', '').send(draftOf('ZTT')).expect(201)).body);
    const id = created.id;
    expect(id).toBe('ztt');
    expect(created).toMatchObject({ prefixLocked: false, formCount: 0 });
    expect(created.versions).toHaveLength(1);
    expect(created.versions[0]).toMatchObject({ version: 1, status: 'draft', updatedBy: { id: 'cb-1' } });
    const edited = ManagedFormTypeSchema.parse((await call('put', `/${id}/versions/1`).send(draftOf('ZTU', { name: 'Tên mới', description: '' })).expect(200)).body);
    expect(edited).toMatchObject({ prefix: 'ZTU', versions: [{ name: 'Tên mới', description: null }] });
    await call('put', `/${id}/versions/1`).send(draftOf('ZTT')).expect(200);

    // Phiên bản Nháp: không đổi trạng thái bằng /status; phiên bản không có thì 404
    expect((await call('put', `/${id}/versions/1/status`).send({ status: 'open' }).expect(409)).body.message).toBe(FORM_TYPE_MESSAGES.draftNotLocked);
    await call('put', `/${id}/versions/9`).send(draftOf('ZTT')).expect(404);
    await call('put', `/${id}/versions/abc`).send(draftOf('ZTT')).expect(404);
    expect((await call('put', `/${id}/versions/1/status`).send({ status: 'draft' }).expect(422)).body.message).toBe(FORM_TYPE_MESSAGES.invalidRequest);

    // Mở luôn khi lưu: khóa nội dung và mã đơn
    const opened = ManagedFormTypeSchema.parse((await call('put', `/${id}/versions/1`).send(draftOf('ZTT', { status: 'open' })).expect(200)).body);
    expect(opened).toMatchObject({ prefixLocked: true, versions: [{ version: 1, status: 'open' }] });
    expect((await call('put', `/${id}/versions/1`).send(draftOf('ZTT')).expect(409)).body.message).toBe(FORM_TYPE_MESSAGES.versionLocked);
    expect((await call('delete', `/${id}/versions/1`).expect(409)).body.message).toBe(FORM_TYPE_MESSAGES.onlyDraftDeletable);
    const detail = FormTypeSchema.parse((await request(server()).get(`/api/form-types/${id}`).set('Cookie', cookie).expect(200)).body);
    expect(detail).toMatchObject({ version: 1, status: 'open', prefix: 'ZTT' });

    // Phiên bản mới: mã đơn khóa nên không đổi; có Nháp rồi thì không thêm nữa
    expect((await call('post', `/${id}/versions`).send(draftOf('ZTU')).expect(409)).body.message).toBe(FORM_TYPE_MESSAGES.prefixLocked);
    const withDraft = ManagedFormTypeSchema.parse((await call('post', `/${id}/versions`).send(draftOf('ZTT', { name: 'Bản hai' })).expect(201)).body);
    expect(withDraft.versions.map((version) => [version.version, version.status])).toEqual([[2, 'draft'], [1, 'open']]);
    expect((await call('post', `/${id}/versions`).send(draftOf('ZTT')).expect(409)).body.message).toBe(FORM_TYPE_MESSAGES.draftExists(2));

    // Mở phiên bản 2 thì phiên bản 1 tự đóng; mở lại phiên bản 1 thì phiên bản 2 đóng
    const second = ManagedFormTypeSchema.parse((await call('put', `/${id}/versions/2`).send(draftOf('ZTT', { name: 'Bản hai', status: 'open' })).expect(200)).body);
    expect(second.versions.map((version) => [version.version, version.status])).toEqual([[2, 'open'], [1, 'closed']]);
    const reopened = ManagedFormTypeSchema.parse((await call('put', `/${id}/versions/1/status`).send({ status: 'open' }).expect(200)).body);
    expect(reopened.versions.map((version) => [version.version, version.status])).toEqual([[2, 'closed'], [1, 'open']]);
    const closed = ManagedFormTypeSchema.parse((await call('put', `/${id}/versions/1/status`).send({ status: 'closed' }).expect(200)).body);
    expect(closed.versions.every((version) => version.status === 'closed')).toBe(true);
    await request(server()).get(`/api/form-types/${id}`).set('Cookie', cookie).expect(404);

    // Thêm phiên bản 3 (Nháp) rồi xóa: loại đơn còn nguyên các phiên bản trước
    await call('post', `/${id}/versions`).send(draftOf('ZTT')).expect(201);
    const afterDelete = ManagedFormTypeSchema.parse((await call('delete', `/${id}/versions/3`).expect(200)).body);
    expect(afterDelete.versions.map((version) => version.version)).toEqual([2, 1]);
  });
});
