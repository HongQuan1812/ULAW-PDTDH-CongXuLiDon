/* Test nhóm API holidays: quyền, thêm / sửa / xóa, kiểm tra body, trùng ngày.
   Cần database đã migrate. Test chỉ dùng năm 2031 (seed không có), ghi lại id đã thêm rồi xóa sạch khi xong. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import {
  ApiErrorBodySchema,
  HOLIDAY_ENDPOINTS,
  HOLIDAY_MESSAGES,
  HolidaySchema,
  HolidaysResponseSchema,
  holidayPath,
  type Holiday,
  type HolidayInput,
  type RoleId,
} from '@ulaw/shared';
import { PrismaService } from '../src/common/prisma.service';
import { createTestApp } from './create-test-app';

const LIST_URL = `/api${HOLIDAY_ENDPOINTS.list}`;

/**
 * Câu báo lỗi trong body response, đúng dạng ApiErrorBody.
 * @param response  response lỗi
 * @returns         câu báo
 */
const messageOf = (response: Response) => ApiErrorBodySchema.parse(response.body).message;

describe('holidays', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  const createdIds: string[] = [];
  const server = () => app.getHttpServer();

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  /** Thêm một ngày nghỉ bằng Admin (mong 201), ghi lại id để dọn. */
  async function addHoliday(holidayInput: HolidayInput): Promise<Holiday> {
    const response = await request(server()).post(LIST_URL).set('Cookie', adminCookie).send(holidayInput).expect(201);
    const holiday = HolidaySchema.parse(response.body);
    createdIds.push(holiday.id);
    return holiday;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    adminCookie = await loginAs('admin');
  });

  afterAll(async () => {
    await prisma.holiday.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  it('chưa đăng nhập: 401 · người nộp đơn, người xử lí đơn: 403', async () => {
    await request(server()).get(LIST_URL).expect(401);
    for (const role of ['nguoiNopDon', 'nguoiXuLiDon'] as const) {
      const cookie = await loginAs(role);
      expect(messageOf(await request(server()).get(LIST_URL).set('Cookie', cookie).expect(403))).toBe(HOLIDAY_MESSAGES[403]);
      await request(server()).post(LIST_URL).set('Cookie', cookie).send({ name: 'Thử', startDate: '2031-01-01', endDate: '2031-01-01' }).expect(403);
    }
  });

  it('thêm, sửa, xóa; danh sách xếp theo lịch', async () => {
    const later = await addHoliday({ name: '  Quốc khánh  ', startDate: '2031-09-01', endDate: '2031-09-02' });
    const earlier = await addHoliday({ name: 'Tết Dương lịch', startDate: '2031-01-01', endDate: '2031-01-01' });
    expect(later.name).toBe('Quốc khánh');

    // Danh sách: đúng hợp đồng, sớm trước muộn sau
    const listed = HolidaysResponseSchema.parse((await request(server()).get(LIST_URL).set('Cookie', adminCookie).expect(200)).body).holidays;
    const ids = listed.map((holiday) => holiday.id);
    expect(ids.indexOf(earlier.id)).toBeLessThan(ids.indexOf(later.id));
    expect(listed.find((holiday) => holiday.id === later.id)).toEqual(later);

    // Sửa
    const updated = await request(server())
      .put(`/api${holidayPath(later.id)}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Quốc khánh', startDate: '2031-09-02', endDate: '2031-09-03' })
      .expect(200);
    expect(HolidaySchema.parse(updated.body)).toEqual({ id: later.id, name: 'Quốc khánh', startDate: '2031-09-02', endDate: '2031-09-03' });

    // Xóa: lần hai thì 404
    await request(server()).delete(`/api${holidayPath(earlier.id)}`).set('Cookie', adminCookie).expect(204);
    expect(messageOf(await request(server()).delete(`/api${holidayPath(earlier.id)}`).set('Cookie', adminCookie).expect(404))).toBe(HOLIDAY_MESSAGES[404]);
    expect(messageOf(await request(server()).put(`/api${holidayPath(earlier.id)}`).set('Cookie', adminCookie).send({ name: 'X', startDate: '2031-01-01', endDate: '2031-01-01' }).expect(404))).toBe(
      HOLIDAY_MESSAGES[404],
    );
  });

  it('trùng ngày với ngày nghỉ khác: 409; sửa chính nó thì không tính trùng', async () => {
    const tet = await addHoliday({ name: 'Tết Nguyên đán', startDate: '2031-01-20', endDate: '2031-01-26' });
    const overlap = await request(server()).post(LIST_URL).set('Cookie', adminCookie).send({ name: 'Nghỉ bù', startDate: '2031-01-26', endDate: '2031-01-27' }).expect(409);
    expect(messageOf(overlap)).toBe(HOLIDAY_MESSAGES.overlaps('Tết Nguyên đán'));

    await request(server()).put(`/api${holidayPath(tet.id)}`).set('Cookie', adminCookie).send({ name: 'Tết Nguyên đán', startDate: '2031-01-21', endDate: '2031-01-27' }).expect(200);
    await addHoliday({ name: 'Nghỉ bù', startDate: '2031-01-28', endDate: '2031-01-28' });
  });

  it('body sai: 422 kèm câu báo của ô sai', async () => {
    const send = (body: object) => request(server()).post(LIST_URL).set('Cookie', adminCookie).send(body).expect(422);
    expect(messageOf(await send({ name: ' ', startDate: '2031-03-01', endDate: '2031-03-01' }))).toBe(HOLIDAY_MESSAGES.nameRequired);
    expect(messageOf(await send({ name: 'X', startDate: '2031-03-02', endDate: '2031-03-01' }))).toBe(HOLIDAY_MESSAGES.endBeforeStart);
    expect(messageOf(await send({ name: 'X', startDate: '2031-02-30', endDate: '2031-03-01' }))).toBe(HOLIDAY_MESSAGES.invalidDate);
    expect(messageOf(await send({ name: 'X', startDate: '2031-03-01', endDate: '2031-04-15' }))).toBe(HOLIDAY_MESSAGES.tooLong);
  });
});
