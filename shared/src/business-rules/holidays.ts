/* Ngày nghỉ (lễ, Tết, nghỉ bù) do Admin nhập: đếm ngày, trải khoảng ngày thành từng ngày cho hàm tính hạn, tìm ngày nghỉ bị trùng.
   Mỗi ngày nghỉ là một khoảng ngày 'YYYY-MM-DD', tính cả hai đầu. Chỉ có hàm thuần. */
import type { HolidayDates } from './forms--deadlines';

/** Một ngày nghỉ, đủ để tính (Holiday của hợp đồng, dòng database đều dùng được). */
export interface HolidayRange {
  /** Ngày đầu 'YYYY-MM-DD' */
  startDate: string;
  /** Ngày cuối 'YYYY-MM-DD', tính cả ngày này */
  endDate: string;
}

const DAY_MS = 86_400_000;

/**
 * Số ngày của một ngày nghỉ, tính cả hai đầu.
 * @param holiday  ngày nghỉ
 * @returns        vd 14/02 → 22/02 là 9; một ngày là 1
 */
export function holidayDayCount(holiday: HolidayRange): number {
  return Math.round((Date.parse(`${holiday.endDate}T00:00:00Z`) - Date.parse(`${holiday.startDate}T00:00:00Z`)) / DAY_MS) + 1;
}

/**
 * Trải các ngày nghỉ thành từng ngày, cho hàm tính hạn (formDeadline, addWorkingMinutes…).
 * @param holidays  các ngày nghỉ
 * @returns         tập ngày 'YYYY-MM-DD'
 */
export function holidayDatesOf(holidays: readonly HolidayRange[]): HolidayDates {
  const dates = new Set<string>();
  for (const holiday of holidays) {
    const end = Date.parse(`${holiday.endDate}T00:00:00Z`);
    for (let day = Date.parse(`${holiday.startDate}T00:00:00Z`); day <= end; day += DAY_MS) {
      dates.add(new Date(day).toISOString().slice(0, 10));
    }
  }
  return dates;
}

/**
 * Tìm ngày nghỉ đã có bị trùng (có chung ít nhất một ngày) với ngày nghỉ đang thêm / sửa.
 * @param input      ngày nghỉ đang thêm / sửa
 * @param holidays   các ngày nghỉ đã có
 * @param exceptId   id ngày nghỉ đang sửa (không so với chính nó); thêm mới thì bỏ trống
 * @returns          ngày nghỉ bị trùng đầu tiên, hoặc undefined
 */
export function findOverlappingHoliday<Holiday extends HolidayRange & { id: string }>(
  input: HolidayRange,
  holidays: readonly Holiday[],
  exceptId?: string,
): Holiday | undefined {
  return holidays.find((holiday) => holiday.id !== exceptId && holiday.startDate <= input.endDate && input.startDate <= holiday.endDate);
}

/**
 * So hai ngày nghỉ để xếp theo lịch: sớm trước, cùng ngày đầu thì ngắn trước.
 * @param first   ngày nghỉ thứ nhất
 * @param second  ngày nghỉ thứ hai
 * @returns       âm nếu first đứng trước
 */
export function compareHolidays(first: HolidayRange, second: HolidayRange): number {
  return first.startDate.localeCompare(second.startDate) || first.endDate.localeCompare(second.endDate);
}
