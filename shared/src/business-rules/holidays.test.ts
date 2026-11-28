import { describe, expect, it } from 'vitest';
import { HOLIDAY_MESSAGES, HolidayInputSchema, isCalendarDate } from '../api-contract/holidays';
import { compareHolidays, findOverlappingHoliday, holidayDatesOf, holidayDayCount } from './holidays';

const TET = { id: 'tet', startDate: '2026-02-14', endDate: '2026-02-22' };
const LABOUR_DAY = { id: 'labour', startDate: '2026-04-30', endDate: '2026-05-01' };

describe('ngày nghỉ', () => {
  it('đếm ngày tính cả hai đầu; một ngày là 1; qua tháng, qua năm vẫn đúng', () => {
    expect(holidayDayCount(TET)).toBe(9);
    expect(holidayDayCount({ startDate: '2026-01-01', endDate: '2026-01-01' })).toBe(1);
    expect(holidayDayCount({ startDate: '2026-12-31', endDate: '2027-01-01' })).toBe(2);
  });

  it('trải thành từng ngày', () => {
    expect([...holidayDatesOf([LABOUR_DAY, { startDate: '2026-02-28', endDate: '2026-03-01' }])]).toEqual([
      '2026-04-30',
      '2026-05-01',
      '2026-02-28',
      '2026-03-01',
    ]);
    expect(holidayDatesOf([TET]).size).toBe(9);
  });

  it('tìm ngày nghỉ trùng: chung một ngày là trùng, liền kề không trùng, bỏ qua chính nó', () => {
    const holidays = [TET, LABOUR_DAY];
    expect(findOverlappingHoliday({ startDate: '2026-02-22', endDate: '2026-02-23' }, holidays)).toBe(TET);
    expect(findOverlappingHoliday({ startDate: '2026-02-10', endDate: '2026-03-01' }, holidays)).toBe(TET);
    expect(findOverlappingHoliday({ startDate: '2026-02-23', endDate: '2026-02-23' }, holidays)).toBeUndefined();
    expect(findOverlappingHoliday({ startDate: '2026-02-15', endDate: '2026-02-16' }, holidays, 'tet')).toBeUndefined();
  });

  it('xếp theo lịch', () => {
    expect([LABOUR_DAY, TET].sort(compareHolidays)).toEqual([TET, LABOUR_DAY]);
  });

  it('kiểm tra body: ngày có thật, cuối không trước đầu, không quá 31 ngày, có tên', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('28/02/2026')).toBe(false);

    expect(HolidayInputSchema.parse({ name: '  Tết  ', startDate: '2026-02-14', endDate: '2026-02-22' }).name).toBe('Tết');
    const messageOf = (input: object) => HolidayInputSchema.safeParse(input).error?.issues[0]?.message;
    expect(messageOf({ name: ' ', startDate: '2026-02-14', endDate: '2026-02-14' })).toBe(HOLIDAY_MESSAGES.nameRequired);
    expect(messageOf({ name: 'Tết', startDate: '2026-02-14', endDate: '2026-02-13' })).toBe(HOLIDAY_MESSAGES.endBeforeStart);
    expect(messageOf({ name: 'Tết', startDate: '2026-01-01', endDate: '2026-02-01' })).toBe(HOLIDAY_MESSAGES.tooLong);
    expect(messageOf({ name: 'Tết', startDate: '2026-01-01', endDate: '2026-01-31' })).toBeUndefined();
    expect(messageOf({ name: 'Tết', startDate: '2026-02-30', endDate: '2026-03-01' })).toBe(HOLIDAY_MESSAGES.invalidDate);
  });
});
