/* Test cấu hình thời gian của loại đơn: GET / PUT time-settings (quyền, luật, dấu đã chạy), thời gian xử lí đặt ở loại đơn,
   bộ hẹn giờ mở / đóng (gọi thẳng một lần kiểm với giờ chọn sẵn).
   Giờ hẹn đã qua không lưu qua API được (bị chặn), nên các test hẹn giờ ghi thẳng cột vào database.
   Cần database đã migrate và seed. Test tạo loại đơn có mã đơn ZTV rồi xóa sạch khi xong. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ApiErrorBodySchema,
  FORM_TYPE_MESSAGES,
  FORM_TYPE_TIME_MESSAGES,
  FormTypeSchema,
  FormTypeTimeSettingsSchema,
  ManagedFormTypeSchema,
  type FormTypeStatus,
  type RoleId,
  type SaveFormTypeTimeSettingsRequest,
  type SaveFormTypeVersionRequest,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { fromVietnamTime } from '../src/common/vietnam-time';
import { FormTypeScheduleService } from '../src/form-types/form-type-schedule.service';
import { createTestApp } from './create-test-app';

const TEST_PREFIX = 'ZTV';
const TEST_ID = 'ztv';

/** Bản soạn hợp lệ nhỏ nhất: một phần, một câu trả lời ngắn. */
function draftOf(overrides: Partial<SaveFormTypeVersionRequest> = {}): SaveFormTypeVersionRequest {
  return {
    prefix: TEST_PREFIX,
    name: 'Loại đơn hẹn giờ',
    description: null,
    maxProcessingDays: null,
    status: 'draft',
    sections: [{ id: 's1', title: 'Phần một', main: true, questions: [{ id: 'q1', type: 'text', label: 'Nội dung thử', required: true }] }],
    ...overrides,
  };
}

describe('cấu hình thời gian của loại đơn', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let schedule: FormTypeScheduleService;
  let cookie: string;
  const server = () => app.getHttpServer();
  const path = `/api/form-types/${TEST_ID}/time-settings`;

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((item) => item.split(';')[0]).join('; ');
  }

  /** Lưu cấu hình thời gian qua API. */
  const saveSettings = (settings: SaveFormTypeTimeSettingsRequest) => request(server()).put(path).set('Cookie', cookie).send(settings);

  /** Trạng thái các phiên bản của loại đơn thử, cũ trước, vd ['closed', 'open']. */
  async function versionStatuses(): Promise<FormTypeStatus[]> {
    const versions = await prisma.formTypeVersion.findMany({ where: { formTypeId: TEST_ID }, orderBy: { version: 'asc' } });
    return versions.map((version) => version.status);
  }

  /** Ghi thẳng giờ hẹn vào database (giờ Việt Nam), chưa chạy. */
  async function setSchedule(autoOpen: { at: string; version: number } | null, closeAt: string | null): Promise<void> {
    await prisma.formType.update({
      where: { id: TEST_ID },
      data: {
        autoOpenAt: autoOpen ? fromVietnamTime(autoOpen.at) : null,
        autoOpenVersion: autoOpen?.version ?? null,
        autoOpenDone: false,
        autoCloseAt: closeAt ? fromVietnamTime(closeAt) : null,
        autoCloseDone: false,
      },
    });
  }

  /** Một lần kiểm vào giờ chọn sẵn, chỉ lấy việc của loại đơn thử, vd ['open 1', 'close 1']. */
  async function checkAt(vietnamTime: string): Promise<string[]> {
    const runs = await schedule.checkSchedules(fromVietnamTime(vietnamTime));
    return runs.filter((run) => run.formTypeId === TEST_ID).map((run) => `${run.kind} ${run.changedVersion ?? '-'}`);
  }

  /** Cấu hình thời gian đọc qua API. */
  const readSettings = async () => FormTypeTimeSettingsSchema.parse((await request(server()).get(path).set('Cookie', cookie).expect(200)).body);

  const cleanUp = () => prisma.formType.deleteMany({ where: { prefix: TEST_PREFIX } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    schedule = app.get(FormTypeScheduleService);
    await cleanUp();
    cookie = await loginAs('nguoiXuLiDon');
  });

  // Mỗi test một loại đơn thử mới: phiên bản 1 Nháp
  beforeEach(async () => {
    await cleanUp();
    await request(server()).post('/api/form-types').set('Cookie', cookie).send(draftOf()).expect(201);
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  it('người nộp đơn: 403; loại đơn không có: 404', async () => {
    const studentCookie = await loginAs('nguoiNopDon');
    for (const call of [request(server()).get(path).set('Cookie', studentCookie), request(server()).put(path).set('Cookie', studentCookie).send({})]) {
      expect(ApiErrorBodySchema.parse((await call.expect(403)).body).message).toBe(FORM_TYPE_MESSAGES[403]);
    }
    await request(server()).get('/api/form-types/khong-co/time-settings').set('Cookie', cookie).expect(404);
  });

  it('loại đơn mới: chưa đặt gì', async () => {
    expect(await readSettings()).toEqual({ maxProcessingDays: null, autoOpen: null, autoClose: null });
  });

  it('thời gian xử lí lưu ở loại đơn: mọi phiên bản, trang nộp đơn cùng thấy; không tạo phiên bản mới', async () => {
    await saveSettings({ maxProcessingDays: 3, autoOpen: null, autoClose: null }).expect(200);
    await request(server()).put(`/api/form-types/${TEST_ID}/versions/1`).set('Cookie', cookie).send(draftOf({ status: 'open' })).expect(200);

    const managed = ManagedFormTypeSchema.parse((await request(server()).get(`/api/form-types/${TEST_ID}/versions`).set('Cookie', cookie).expect(200)).body);
    expect(managed.versions.map((version) => [version.version, version.maxProcessingDays])).toEqual([[1, 3]]);
    // Trang nộp đơn (đơn nộp chụp đúng dữ liệu này)
    const detail = FormTypeSchema.parse((await request(server()).get(`/api/form-types/${TEST_ID}`).set('Cookie', cookie).expect(200)).body);
    expect(detail.maxProcessingDays).toBe(3);
  });

  it('lưu giờ hẹn; sai luật thì 422 với câu báo như khung Cấu hình thời gian', async () => {
    const settings = { maxProcessingDays: null, autoOpen: { at: '2099-12-01T08:00', version: 1 }, autoClose: { at: '2099-12-05T17:00' } };
    const saved = FormTypeTimeSettingsSchema.parse((await saveSettings(settings).expect(200)).body);
    expect(saved).toEqual({ maxProcessingDays: null, autoOpen: { ...settings.autoOpen, done: false }, autoClose: { ...settings.autoClose, done: false } });
    expect(await readSettings()).toEqual(saved);

    const messageOf = async (body: object) => ApiErrorBodySchema.parse((await request(server()).put(path).set('Cookie', cookie).send(body).expect(422)).body).message;
    expect(await messageOf({ ...settings, autoClose: { at: '2099-11-30T17:00' } })).toBe(FORM_TYPE_TIME_MESSAGES.closeBeforeOpen);
    expect(await messageOf({ ...settings, autoOpen: { at: '2099-12-01T08:00', version: 5 } })).toBe(FORM_TYPE_TIME_MESSAGES.versionMissing(5));
    expect(await messageOf({ ...settings, autoClose: { at: '2020-01-01T08:00' } })).toContain(FORM_TYPE_TIME_MESSAGES.inThePast);
    expect(await messageOf({ ...settings, autoClose: { at: '2099-02-30T08:00' } })).toBe('Giờ hẹn phải có dạng ngày giờ hợp lệ.');
    expect(await messageOf({ ...settings, maxProcessingDays: 0 })).toBe('Thời gian xử lí tối đa ít nhất 1 ngày làm việc.');
    expect(await messageOf({ maxProcessingDays: 'năm' })).toBe(FORM_TYPE_MESSAGES.invalidRequest);
  });

  it('tới giờ tự mở: mở bản Nháp, đánh dấu đã mở; kiểm lại hay restart không chạy lại', async () => {
    await setSchedule({ at: '2026-12-01T08:00', version: 1 }, null);
    expect(await checkAt('2026-12-01T07:59')).toEqual([]);
    expect(await checkAt('2026-12-01T08:00')).toEqual(['open 1']);
    expect(await versionStatuses()).toEqual(['open']);
    expect((await readSettings()).autoOpen).toEqual({ at: '2026-12-01T08:00', version: 1, done: true });
    expect(await checkAt('2026-12-01T08:01')).toEqual([]);
  });

  it('tự mở phiên bản 2 thì phiên bản 1 đang mở tự đóng; tới giờ tự đóng thì đóng phiên bản đang mở', async () => {
    await request(server()).put(`/api/form-types/${TEST_ID}/versions/1`).set('Cookie', cookie).send(draftOf({ status: 'open' })).expect(200);
    await request(server()).post(`/api/form-types/${TEST_ID}/versions`).set('Cookie', cookie).send(draftOf()).expect(201);
    await setSchedule({ at: '2026-12-01T08:00', version: 2 }, '2026-12-05T17:00');

    expect(await checkAt('2026-12-01T08:00')).toEqual(['open 2']);
    expect(await versionStatuses()).toEqual(['closed', 'open']);
    expect(await checkAt('2026-12-05T17:00')).toEqual(['close 2']);
    expect(await versionStatuses()).toEqual(['closed', 'closed']);
    expect(await readSettings()).toMatchObject({ autoOpen: { done: true }, autoClose: { done: true } });
  });

  it('máy chủ tắt qua cả hai giờ: lần kiểm đầu mở rồi đóng', async () => {
    await setSchedule({ at: '2026-12-01T08:00', version: 1 }, '2026-12-05T17:00');
    expect(await checkAt('2026-12-06T09:00')).toEqual(['open 1', 'close 1']);
    expect(await versionStatuses()).toEqual(['closed']);
  });

  it('cán bộ đã đóng tay trước giờ đóng: tới giờ không đổi gì, vẫn đánh dấu đã đóng', async () => {
    await request(server()).put(`/api/form-types/${TEST_ID}/versions/1`).set('Cookie', cookie).send(draftOf({ status: 'open' })).expect(200);
    await request(server()).put(`/api/form-types/${TEST_ID}/versions/1/status`).set('Cookie', cookie).send({ status: 'closed' }).expect(200);
    await setSchedule(null, '2026-12-05T17:00');

    expect(await checkAt('2026-12-05T17:00')).toEqual(['close -']);
    expect(await versionStatuses()).toEqual(['closed']);
    expect((await readSettings()).autoClose).toEqual({ at: '2026-12-05T17:00', done: true });
  });

  it('bản Nháp chưa hợp lệ để mở (chưa có câu hỏi): không mở, đánh dấu đã chạy', async () => {
    // Bản Nháp chỉ có một phần trống (lưu được khi còn Nháp, nhưng không mở được)
    await prisma.formTypeVersion.update({
      where: { formTypeId_version: { formTypeId: TEST_ID, version: 1 } },
      data: { sections: [{ id: 's1', title: 'Phần một', main: true, questions: [] }] },
    });
    await setSchedule({ at: '2026-12-01T08:00', version: 1 }, null);

    expect(await checkAt('2026-12-01T08:00')).toEqual(['open -']);
    expect(await versionStatuses()).toEqual(['draft']);
    expect(await checkAt('2026-12-01T08:01')).toEqual([]);
  });

  it('lưu lại giữ nguyên giờ đã chạy thì giữ dấu; sửa giờ thì bỏ dấu', async () => {
    await setSchedule({ at: '2026-12-01T08:00', version: 1 }, null);
    await checkAt('2026-12-01T08:00');

    // Giữ giờ đã qua (đã chạy), chỉ sửa thời gian xử lí: lưu được, vẫn ✓
    const kept = FormTypeTimeSettingsSchema.parse((await saveSettings({ maxProcessingDays: 4, autoOpen: { at: '2026-12-01T08:00', version: 1 }, autoClose: null }).expect(200)).body);
    expect(kept.autoOpen).toEqual({ at: '2026-12-01T08:00', version: 1, done: true });

    // Hẹn đợt mới: sửa giờ, dấu bỏ
    const moved = FormTypeTimeSettingsSchema.parse((await saveSettings({ maxProcessingDays: 4, autoOpen: { at: '2099-01-04T08:00', version: 1 }, autoClose: null }).expect(200)).body);
    expect(moved.autoOpen).toEqual({ at: '2099-01-04T08:00', version: 1, done: false });
  });
});
