/* HỢP ĐỒNG nhóm API Ngày nghỉ (chỉ vai trò có quyền manageHolidays: Admin): các ngày nghỉ ngoài Thứ Bảy, Chủ nhật (lễ, Tết, nghỉ bù).
   Mỗi ngày nghỉ là một ngày hoặc một khoảng ngày liền nhau, kèm tên. Hạn xử lí đơn không tính các ngày này (business-rules/forms--deadlines.ts).
   Không có ngày làm bù: Thứ Bảy, Chủ nhật luôn nghỉ, nên chỉ nhập ngày được nghỉ.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import { holidayDayCount } from '../business-rules/holidays';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const HOLIDAY_ENDPOINTS = {
  /** GET → HolidaysResponse: mọi ngày nghỉ, sớm trước muộn sau · POST HolidayInput → Holiday (201): thêm ngày nghỉ */
  list: '/holidays',
  /** PUT HolidayInput → Holiday: sửa · DELETE → 204: xóa */
  holiday: '/holidays/:holidayId',
} as const;

/**
 * Đường dẫn API của một ngày nghỉ.
 * @param holidayId  id ngày nghỉ
 * @returns          vd '/holidays/holiday-2026-tet'
 */
export function holidayPath(holidayId: string): string {
  return HOLIDAY_ENDPOINTS.holiday.replace(':holidayId', encodeURIComponent(holidayId));
}

/* ---------- Câu thông báo ---------- */

/** Một ngày nghỉ dài nhất bao nhiêu ngày (tính cả hai đầu), để tránh gõ nhầm năm. */
export const HOLIDAY_MAX_DAYS = 31;

/** Tên ngày nghỉ dài nhất bao nhiêu chữ. */
export const HOLIDAY_NAME_MAX_LENGTH = 100;

export const HOLIDAY_MESSAGES = {
  401: 'Bạn chưa đăng nhập.',
  /** Mọi API của nhóm khi không có quyền manageHolidays */
  403: 'Bạn không có quyền quản lí ngày nghỉ.',
  404: 'Ngày nghỉ không còn (có thể đã bị xóa).',
  /** Body sai dạng */
  422: 'Dữ liệu ngày nghỉ không hợp lệ.',
  nameRequired: 'Chưa nhập tên ngày nghỉ.',
  nameTooLong: `Tên ngày nghỉ không quá ${HOLIDAY_NAME_MAX_LENGTH} chữ.`,
  invalidDate: 'Ngày không hợp lệ.',
  endBeforeStart: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
  tooLong: `Một ngày nghỉ dài nhất ${HOLIDAY_MAX_DAYS} ngày. Nghỉ dài hơn thì nhập thành nhiều dòng.`,
  /**
   * Trùng với một ngày nghỉ đã có (409).
   * @param name  tên ngày nghỉ đã có
   * @returns     câu báo
   */
  overlaps: (name: string) => `Trùng với ngày nghỉ “${name}” đã có.`,
  /**
   * @param name  tên ngày nghỉ
   * @returns     câu báo sau khi thêm
   */
  created: (name: string) => `Đã thêm ngày nghỉ “${name}”.`,
  /**
   * @param name  tên ngày nghỉ
   * @returns     câu báo sau khi sửa
   */
  saved: (name: string) => `Đã lưu ngày nghỉ “${name}”.`,
  /**
   * @param name  tên ngày nghỉ
   * @returns     câu báo sau khi xóa
   */
  removed: (name: string) => `Đã xóa ngày nghỉ “${name}”.`,
} as const;

/* ---------- Dữ liệu gửi / nhận ---------- */

/**
 * Chuỗi có phải ngày có thật dạng 'YYYY-MM-DD' không.
 * @param text  chuỗi
 * @returns     true nếu đúng dạng và có thật (vd '2026-02-30' là sai)
 */
export function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

/** Ngày 'YYYY-MM-DD' có thật. */
const CalendarDateSchema = z.string().refine(isCalendarDate, HOLIDAY_MESSAGES.invalidDate);

/** Body của POST /holidays, PUT /holidays/:holidayId. Một ngày thì ngày bắt đầu = ngày kết thúc. */
export const HolidayInputSchema = z
  .object({
    name: z.string().trim().min(1, HOLIDAY_MESSAGES.nameRequired).max(HOLIDAY_NAME_MAX_LENGTH, HOLIDAY_MESSAGES.nameTooLong),
    /** Ngày đầu, 'YYYY-MM-DD' */
    startDate: CalendarDateSchema,
    /** Ngày cuối (tính cả ngày này), 'YYYY-MM-DD' */
    endDate: CalendarDateSchema,
  })
  .superRefine((holiday, context) => {
    if (!isCalendarDate(holiday.startDate) || !isCalendarDate(holiday.endDate)) return;
    if (holiday.endDate < holiday.startDate) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: HOLIDAY_MESSAGES.endBeforeStart });
    } else if (holidayDayCount(holiday) > HOLIDAY_MAX_DAYS) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: HOLIDAY_MESSAGES.tooLong });
    }
  });
export type HolidayInput = z.infer<typeof HolidayInputSchema>;

/** Một ngày nghỉ. */
export const HolidaySchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});
export type Holiday = z.infer<typeof HolidaySchema>;

/** Trả về từ GET /holidays: mọi ngày nghỉ (ít, nên trả hết một lượt), sớm trước muộn sau. */
export const HolidaysResponseSchema = z.object({ holidays: z.array(HolidaySchema) });
export type HolidaysResponse = z.infer<typeof HolidaysResponseSchema>;
