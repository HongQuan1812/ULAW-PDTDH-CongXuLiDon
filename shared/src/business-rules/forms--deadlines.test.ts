import { describe, expect, it, test } from 'vitest';
import type { FormEventAction } from '../aux-schema/forms--events';
import type { FormStatus } from '../aux-schema/forms--statuses';
import {
  addWorkingMinutes,
  countDeadlineStates,
  deadlineDetailText,
  formDeadline,
  isWorkingDay,
  vietnamTimeOf,
  workingDurationText,
  workingMinutesBetween,
  type DeadlineEvent,
} from './forms--deadlines';

/* Lịch dùng trong test: Thứ Sáu 27/11/2026, Thứ Hai 30/11, Thứ Ba 01/12 … Thứ Sáu 04/12, Thứ Hai 07/12. */
const NO_HOLIDAYS = new Set<string>();
const HOUR = 60;
const DAY = 24 * HOUR;

/**
 * Một dòng lịch sử cho test.
 * @param action  việc
 * @param at      lúc làm 'YYYY-MM-DDTHH:mm'
 * @param status  trạng thái sau việc đó
 * @returns       dòng lịch sử
 */
const event = (action: FormEventAction, at: string, status: FormStatus): DeadlineEvent => ({ action, at, status });

/** Đơn nộp 10:00 Thứ Sáu 27/11 rồi được tiếp nhận Thứ Hai 30/11. */
const SUBMITTED_AND_RECEIVED = [event('submit', '2026-11-27T10:00', 'nop'), event('receive', '2026-11-30T08:00', 'xet')];

describe('thời gian làm việc', () => {
  it('Thứ Bảy, Chủ nhật và ngày nghỉ không phải ngày làm việc', () => {
    expect(isWorkingDay('2026-11-27', NO_HOLIDAYS)).toBe(true);
    expect(isWorkingDay('2026-11-28', NO_HOLIDAYS)).toBe(false);
    expect(isWorkingDay('2026-11-29', NO_HOLIDAYS)).toBe(false);
    expect(isWorkingDay('2026-12-01', new Set(['2026-12-01']))).toBe(false);
  });

  it('đếm thời gian làm việc giữa hai thời điểm: bỏ cuối tuần, bỏ ngày nghỉ, ngược chiều thì 0', () => {
    expect(workingMinutesBetween('2026-11-27T10:00', '2026-11-30T10:00', NO_HOLIDAYS)).toBe(24 * HOUR);
    expect(workingMinutesBetween('2026-11-28T15:00', '2026-11-30T01:00', NO_HOLIDAYS)).toBe(HOUR);
    expect(workingMinutesBetween('2026-11-30T10:00', '2026-12-02T10:00', new Set(['2026-12-01']))).toBe(DAY);
    expect(workingMinutesBetween('2026-11-30T10:00', '2026-11-27T10:00', NO_HOLIDAYS)).toBe(0);
  });

  it('cộng thời gian làm việc: nhảy qua cuối tuần, ngày nghỉ; nộp vào cuối tuần thì chạy từ 00:00 Thứ Hai', () => {
    expect(addWorkingMinutes('2026-11-27T10:00', 3 * DAY, NO_HOLIDAYS)).toBe('2026-12-02T10:00');
    expect(addWorkingMinutes('2026-11-27T10:00', 3 * DAY, new Set(['2026-12-01']))).toBe('2026-12-03T10:00');
    expect(addWorkingMinutes('2026-11-28T15:00', 3 * DAY, NO_HOLIDAYS)).toBe('2026-12-03T00:00');
    expect(addWorkingMinutes('2026-11-27T10:00', 14 * HOUR, NO_HOLIDAYS)).toBe('2026-11-28T00:00');
    expect(addWorkingMinutes('2026-11-27T10:00', 0, NO_HOLIDAYS)).toBe('2026-11-27T10:00');
  });

  it('trừ thời gian làm việc: lùi qua cuối tuần', () => {
    expect(addWorkingMinutes('2026-12-02T10:00', -3 * DAY, NO_HOLIDAYS)).toBe('2026-11-27T10:00');
    expect(addWorkingMinutes('2026-11-30T05:00', -6 * HOUR, NO_HOLIDAYS)).toBe('2026-11-27T23:00');
  });

  it('giờ Việt Nam: 18:30 UTC đã sang ngày hôm sau', () => {
    expect(vietnamTimeOf(new Date('2026-11-26T18:30:00Z'))).toBe('2026-11-27T01:30');
  });

  it('chữ hiện khoảng thời gian: ngày, giờ, phút', () => {
    expect(workingDurationText(2 * DAY + 2 * HOUR)).toBe('2 ngày 2 giờ');
    expect(workingDurationText(DAY)).toBe('1 ngày');
    expect(workingDurationText(-5 * HOUR - 10)).toBe('5 giờ');
    expect(workingDurationText(45)).toBe('45 phút');
  });
});

describe('hạn xử lí của lá đơn', () => {
  it('loại đơn không giới hạn, hoặc lịch sử trống: tình trạng Không có hạn, các số null', () => {
    const none = { state: 'none', maxDays: null, dueAt: null, remainingMinutes: null };
    expect(formDeadline(null, SUBMITTED_AND_RECEIVED, '2026-11-27T10:00', NO_HOLIDAYS)).toEqual(none);
    expect(formDeadline(3, [], '2026-11-27T10:00', NO_HOLIDAYS)).toEqual(none);
  });

  it('hạn tính ngay từ lúc nộp; Còn hạn → Sắp tới hạn (còn 1 ngày trở xuống) → Quá hạn', () => {
    const deadlineAt = (now: string) => formDeadline(3, SUBMITTED_AND_RECEIVED, now, NO_HOLIDAYS);

    expect(deadlineAt('2026-11-27T10:00')).toEqual({ state: 'onTrack', maxDays: 3, dueAt: '2026-12-02T10:00', remainingMinutes: 3 * DAY });
    expect(deadlineAt('2026-11-28T12:00')).toMatchObject({ state: 'onTrack', remainingMinutes: 2 * DAY + 10 * HOUR });
    expect(deadlineAt('2026-12-01T09:00')).toMatchObject({ state: 'onTrack', remainingMinutes: DAY + HOUR });
    expect(deadlineAt('2026-12-01T10:00')).toMatchObject({ state: 'dueSoon', remainingMinutes: DAY });
    expect(deadlineAt('2026-12-02T09:30')).toMatchObject({ state: 'dueSoon', remainingMinutes: 30 });
    expect(deadlineAt('2026-12-02T11:00')).toMatchObject({ state: 'overdue', remainingMinutes: -HOUR });
  });

  it('quá hạn trong cuối tuần chỉ tính trễ phần thuộc ngày làm việc', () => {
    const history = [event('submit', '2026-11-30T10:00', 'nop')];

    expect(formDeadline(4, history, '2026-12-05T12:00', NO_HOLIDAYS)).toMatchObject({ state: 'overdue', dueAt: '2026-12-04T10:00', remainingMinutes: -14 * HOUR });
    expect(formDeadline(4, history, '2026-12-07T01:00', NO_HOLIDAYS)).toMatchObject({ state: 'overdue', remainingMinutes: -15 * HOUR });
  });

  it('ngày nghỉ làm hạn lùi lại', () => {
    expect(formDeadline(3, SUBMITTED_AND_RECEIVED, '2026-11-27T10:00', new Set(['2026-12-01']))).toMatchObject({ dueAt: '2026-12-03T10:00' });
  });

  it('đang chờ bổ sung: chưa có hạn, ghi thời gian còn lại; tình trạng theo phần còn lại, không theo bây giờ', () => {
    const history = [...SUBMITTED_AND_RECEIVED, event('requestSupplement', '2026-11-30T10:00', 'bs')];

    // đã dùng 14 giờ Thứ Sáu + 10 giờ Thứ Hai: còn 2 ngày, bao lâu sau vẫn Còn hạn
    expect(formDeadline(3, history, '2026-12-03T08:00', NO_HOLIDAYS)).toEqual({ state: 'onTrack', maxDays: 3, dueAt: null, remainingMinutes: 2 * DAY });
    expect(formDeadline(3, history, '2027-01-20T08:00', NO_HOLIDAYS)).toMatchObject({ state: 'onTrack', dueAt: null });

    // dừng khi còn 1 ngày trở xuống: Sắp tới hạn; dừng khi đã qua hạn: Quá hạn
    expect(formDeadline(2, history, '2026-12-03T08:00', NO_HOLIDAYS)).toMatchObject({ state: 'dueSoon', dueAt: null, remainingMinutes: DAY });
    expect(formDeadline(1, history, '2026-12-03T08:00', NO_HOLIDAYS)).toMatchObject({ state: 'overdue', dueAt: null, remainingMinutes: 0 });
  });

  it('bổ sung xong: chạy tiếp phần còn lại từ lúc bổ sung; nhiều lần chờ thì cộng dồn', () => {
    const firstSupplement = [
      ...SUBMITTED_AND_RECEIVED,
      event('requestSupplement', '2026-11-30T10:00', 'bs'),
      event('supplement', '2026-12-03T10:00', 'bsg'),
    ];
    const secondSupplement = [
      ...firstSupplement,
      event('receive', '2026-12-03T11:00', 'xet'),
      event('requestSupplement', '2026-12-04T10:00', 'bs'),
      event('supplement', '2026-12-07T10:00', 'bsg'),
    ];

    // còn 2 ngày: 14 giờ Thứ Năm + 24 giờ Thứ Sáu + 10 giờ Thứ Hai
    expect(formDeadline(3, firstSupplement, '2026-12-03T10:00', NO_HOLIDAYS)).toMatchObject({ state: 'onTrack', dueAt: '2026-12-07T10:00', remainingMinutes: 2 * DAY });
    // lần hai dùng thêm 1 ngày (Thứ Năm 10:00 → Thứ Sáu 10:00), còn 1 ngày
    expect(formDeadline(3, secondSupplement, '2026-12-07T10:00', NO_HOLIDAYS)).toMatchObject({ state: 'dueSoon', dueAt: '2026-12-08T10:00', remainingMinutes: DAY });
  });

  it('yêu cầu bổ sung khi đã quá hạn: bổ sung xong vẫn quá hạn, trễ đúng phần đã trễ', () => {
    const history = [
      event('submit', '2026-11-27T10:00', 'nop'),
      event('receive', '2026-11-27T11:00', 'xet'),
      event('requestSupplement', '2026-12-01T10:00', 'bs'),
      event('supplement', '2026-12-02T10:00', 'bsg'),
    ];

    expect(formDeadline(1, history, '2026-12-02T10:00', NO_HOLIDAYS)).toMatchObject({ state: 'overdue', dueAt: '2026-12-01T10:00', remainingMinutes: -DAY });
  });

  it('sửa đơn, chuyển giao không làm đổi hạn', () => {
    const edited = [event('submit', '2026-11-27T10:00', 'nop'), event('edit', '2026-11-30T09:00', 'nop')];
    const transferred = [...SUBMITTED_AND_RECEIVED, event('transfer', '2026-11-30T09:00', 'xet')];

    expect(formDeadline(3, edited, '2026-11-30T10:00', NO_HOLIDAYS)).toMatchObject({ dueAt: '2026-12-02T10:00' });
    expect(formDeadline(3, transferred, '2026-11-30T10:00', NO_HOLIDAYS)).toMatchObject({ dueAt: '2026-12-02T10:00' });
  });

  it('đã Duyệt / Từ chối: so lúc ra quyết định với hạn, không theo bây giờ', () => {
    const approvedOnTime = [...SUBMITTED_AND_RECEIVED, event('approve', '2026-12-02T09:00', 'duyet')];
    const rejectedLate = [...SUBMITTED_AND_RECEIVED, event('reject', '2026-12-03T10:00', 'tc'), event('transfer', '2026-12-03T11:00', 'tc')];

    expect(formDeadline(3, approvedOnTime, '2026-12-20T00:00', NO_HOLIDAYS)).toEqual({ state: 'doneOnTime', maxDays: 3, dueAt: '2026-12-02T10:00', remainingMinutes: HOUR });
    expect(formDeadline(3, rejectedLate, '2026-12-20T00:00', NO_HOLIDAYS)).toMatchObject({ state: 'doneLate', remainingMinutes: -DAY });
  });
});

describe('câu nói thêm cạnh tình trạng hạn', () => {
  it('còn hạn, sắp tới hạn nói còn bao lâu; quá hạn, xong trễ nói trễ bao lâu; đang chờ bổ sung thì nói thêm', () => {
    const base = { maxDays: 3, dueAt: '2026-12-02T10:00' };
    expect(deadlineDetailText({ ...base, state: 'onTrack', remainingMinutes: 2 * DAY + 3 * HOUR })).toBe('Còn 2 ngày 3 giờ');
    expect(deadlineDetailText({ ...base, state: 'dueSoon', remainingMinutes: 5 * HOUR })).toBe('Còn 5 giờ');
    expect(deadlineDetailText({ ...base, state: 'onTrack', dueAt: null, remainingMinutes: 3 * DAY })).toBe('Còn 3 ngày, tính tiếp khi bổ sung xong');
    expect(deadlineDetailText({ ...base, state: 'overdue', dueAt: null, remainingMinutes: -5 * HOUR })).toBe('Trễ 5 giờ, tính tiếp khi bổ sung xong');
    expect(deadlineDetailText({ ...base, state: 'overdue', remainingMinutes: -DAY })).toBe('Trễ 1 ngày');
    expect(deadlineDetailText({ ...base, state: 'doneLate', remainingMinutes: -2 * HOUR })).toBe('Trễ 2 giờ');
  });

  it('không có hạn thì không nói thêm', () => {
    expect(deadlineDetailText({ state: 'none', maxDays: null, dueAt: null, remainingMinutes: null })).toBeNull();
  });

  it('xong đúng hạn, hoặc qua hạn chỉ trong ngày nghỉ, thì không nói thêm', () => {
    const base = { maxDays: 3, dueAt: '2026-12-05T00:00' };
    expect(deadlineDetailText({ ...base, state: 'doneOnTime', remainingMinutes: DAY })).toBeNull();
    expect(deadlineDetailText({ ...base, state: 'overdue', remainingMinutes: 0 })).toBeNull();
  });
});

describe('đếm đơn theo tình trạng hạn', () => {
  test('đủ mọi tình trạng (chưa có thì 0), kể cả Không có hạn', () => {
    expect(countDeadlineStates(['overdue', 'none', 'overdue', 'onTrack', 'none', 'none'])).toEqual({
      onTrack: 1,
      dueSoon: 0,
      overdue: 2,
      doneOnTime: 0,
      doneLate: 0,
      none: 3,
    });
    expect(Object.values(countDeadlineStates([]))).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
