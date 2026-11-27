/* Tính hạn xử lí của lá đơn theo thời gian làm việc. Máy chủ (API giả và backend) gọi mỗi lần trả đơn, gửi thư nhắc.
   - Thời gian làm việc: trọn 24 giờ của mỗi ngày Thứ Hai đến Thứ Sáu, trừ ngày nghỉ do Admin nhập.
     Không có ngày làm bù: Thứ Bảy, Chủ nhật luôn nghỉ.
   - Hạn: đồng hồ chạy từ đúng lúc nộp, đủ N × 24 giờ làm việc (N = thời gian xử lí tối đa của loại đơn) là hết hạn.
   - Chờ bổ sung: đồng hồ dừng từ lúc Yêu cầu bổ sung tới lúc sinh viên gửi bổ sung, rồi chạy tiếp phần còn lại.
   Mọi thời điểm là giờ Việt Nam 'YYYY-MM-DDTHH:mm', ngày dạng 'YYYY-MM-DD'. Chỉ có hàm thuần. */
import { DEADLINE_STATES, type DeadlineState, type FormDeadline } from '../aux-schema/forms--deadlines';
import type { FormEventAction } from '../aux-schema/forms--events';
import type { FormStatus } from '../aux-schema/forms--statuses';

/** Phút trong một ngày làm việc (24 giờ). */
export const WORKING_DAY_MINUTES = 24 * 60;

/** Còn từng này phút làm việc trở xuống (1 ngày) thì Sắp tới hạn. */
export const DUE_SOON_MINUTES = WORKING_DAY_MINUTES;

/** Các ngày nghỉ (ngoài Thứ Bảy, Chủ nhật), mỗi ngày một chuỗi 'YYYY-MM-DD'. */
export type HolidayDates = ReadonlySet<string>;

/** Một dòng lịch sử đơn, đủ để tính hạn (FormEvent của hợp đồng, SeedFormEvent của dữ liệu mẫu đều dùng được). */
export interface DeadlineEvent {
  action: FormEventAction;
  /** Lúc làm, giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
  at: string;
  /** Trạng thái đơn ngay sau việc này */
  status: FormStatus;
}

const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/* ---------- Đổi qua lại thời điểm và số phút ---------- */

/**
 * Số phút của một thời điểm giờ Việt Nam, đếm như giờ UTC (chỉ để cộng trừ, so sánh).
 * @param vietnamTime  'YYYY-MM-DDTHH:mm'
 * @returns            số phút
 */
const minutesOf = (vietnamTime: string) => Date.parse(`${vietnamTime}:00Z`) / 60_000;

/**
 * Ngược lại của minutesOf.
 * @param minutes  số phút
 * @returns        'YYYY-MM-DDTHH:mm'
 */
const timeOf = (minutes: number) => new Date(minutes * 60_000).toISOString().slice(0, 16);

/**
 * Bây giờ (hoặc một thời điểm bất kì) theo giờ Việt Nam.
 * @param moment  thời điểm, vd new Date()
 * @returns       'YYYY-MM-DDTHH:mm', vd 2026-11-26T18:30Z → '2026-11-27T01:30'
 */
export function vietnamTimeOf(moment: Date): string {
  return new Date(moment.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 16);
}

/* ---------- Thời gian làm việc ---------- */

/**
 * Một ngày có phải ngày làm việc không.
 * @param date      'YYYY-MM-DD'
 * @param holidays  các ngày nghỉ
 * @returns         true nếu là Thứ Hai đến Thứ Sáu và không phải ngày nghỉ
 */
export function isWorkingDay(date: string, holidays: HolidayDates): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !holidays.has(date);
}

/**
 * Ngày làm việc chứa một phút không.
 * @param minutes   số phút (theo minutesOf)
 * @param holidays  các ngày nghỉ
 * @returns         true nếu phút đó thuộc ngày làm việc
 */
const isWorkingMinute = (minutes: number, holidays: HolidayDates) => isWorkingDay(timeOf(minutes).slice(0, 10), holidays);

/**
 * Thời gian làm việc giữa hai thời điểm.
 * @param from      'YYYY-MM-DDTHH:mm'
 * @param to        'YYYY-MM-DDTHH:mm'
 * @param holidays  các ngày nghỉ
 * @returns         số phút thuộc ngày làm việc trong khoảng [from, to); to không sau from thì 0
 */
export function workingMinutesBetween(from: string, to: string, holidays: HolidayDates): number {
  const end = minutesOf(to);
  let total = 0;
  for (let cursor = minutesOf(from); cursor < end; ) {
    const dayEnd = (Math.floor(cursor / WORKING_DAY_MINUTES) + 1) * WORKING_DAY_MINUTES;
    const segmentEnd = Math.min(dayEnd, end);
    if (isWorkingMinute(cursor, holidays)) total += segmentEnd - cursor;
    cursor = segmentEnd;
  }
  return total;
}

/**
 * Cộng (hoặc trừ) thời gian làm việc vào một thời điểm, bỏ qua ngày nghỉ.
 * @param from      'YYYY-MM-DDTHH:mm'
 * @param minutes   số phút làm việc; âm thì lùi lại
 * @param holidays  các ngày nghỉ
 * @returns         'YYYY-MM-DDTHH:mm', vd ('2026-11-27T10:00' Thứ Sáu, 3 ngày) → '2026-12-02T10:00' Thứ Tư.
 *                  Hết đúng lúc cuối ngày thì trả 00:00 hôm sau
 */
export function addWorkingMinutes(from: string, minutes: number, holidays: HolidayDates): string {
  let cursor = minutesOf(from);
  let left = Math.abs(minutes);

  // Tiến tới: đi hết từng ngày, ngày làm việc thì trừ dần phần còn lại
  if (minutes >= 0) {
    while (left > 0) {
      const dayEnd = (Math.floor(cursor / WORKING_DAY_MINUTES) + 1) * WORKING_DAY_MINUTES;
      if (isWorkingMinute(cursor, holidays)) {
        if (left <= dayEnd - cursor) return timeOf(cursor + left);
        left -= dayEnd - cursor;
      }
      cursor = dayEnd;
    }
    return timeOf(cursor);
  }

  // Lùi lại: như trên, đi ngược từng ngày
  while (left > 0) {
    const dayStart = Math.ceil(cursor / WORKING_DAY_MINUTES - 1) * WORKING_DAY_MINUTES;
    if (isWorkingMinute(dayStart, holidays)) {
      if (left <= cursor - dayStart) return timeOf(cursor - left);
      left -= cursor - dayStart;
    }
    cursor = dayStart;
  }
  return timeOf(cursor);
}

/**
 * Thời gian làm việc từ một thời điểm tới hạn.
 * @param at        thời điểm đang xét (bây giờ, hoặc lúc ra quyết định)
 * @param dueAt     hạn
 * @param holidays  các ngày nghỉ
 * @returns         số phút; ≥ 0 nếu chưa qua hạn, âm nếu đã trễ (qua hạn trong lúc nghỉ, vd hạn 00:00 Thứ Bảy, thì trễ 0)
 */
function minutesUntil(at: string, dueAt: string, holidays: HolidayDates): number {
  if (at <= dueAt) return workingMinutesBetween(at, dueAt, holidays);
  const lateMinutes = workingMinutesBetween(dueAt, at, holidays);
  return lateMinutes === 0 ? 0 : -lateMinutes;
}

/**
 * Chữ hiện một khoảng thời gian làm việc.
 * @param minutes  số phút (âm thì lấy độ lớn)
 * @returns        vd 3000 → '2 ngày 2 giờ', 1440 → '1 ngày', 300 → '5 giờ', 45 → '45 phút'
 */
export function workingDurationText(minutes: number): string {
  const total = Math.abs(minutes);
  const days = Math.floor(total / WORKING_DAY_MINUTES);
  const hours = Math.floor((total % WORKING_DAY_MINUTES) / 60);
  if (days > 0) return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  if (hours > 0) return `${hours} giờ`;
  return `${total % 60} phút`;
}

/* ---------- Hạn của lá đơn ---------- */

/**
 * Hạn xử lí và tình trạng hạn của một lá đơn, tính từ lịch sử.
 * @param maxDays   thời gian xử lí tối đa lúc nộp (bản chụp loại đơn), ngày làm việc; null = không giới hạn
 * @param history   lịch sử đơn, cũ nhất trước, dòng đầu là Nộp đơn
 * @param now       bây giờ, giờ Việt Nam 'YYYY-MM-DDTHH:mm' (vietnamTimeOf(new Date()))
 * @param holidays  các ngày nghỉ
 * @returns         hạn và tình trạng hạn; không giới hạn (hoặc lịch sử trống) thì tình trạng 'none', các số null
 */
export function formDeadline(maxDays: number | null, history: readonly DeadlineEvent[], now: string, holidays: HolidayDates): FormDeadline {
  if (maxDays === null || history.length === 0) return { state: 'none', maxDays: null, dueAt: null, remainingMinutes: null };
  const totalMinutes = maxDays * WORKING_DAY_MINUTES;

  // Cộng thời gian đã dùng của các đoạn đồng hồ chạy; đang chờ bổ sung thì runningSince = null
  let usedMinutes = 0;
  let runningSince: string | null = history[0]!.at;
  for (const event of history) {
    if (event.action === 'requestSupplement' && runningSince !== null) {
      usedMinutes += workingMinutesBetween(runningSince, event.at, holidays);
      runningSince = null;
    }
    if (event.action === 'supplement' && runningSince === null) runningSince = event.at;
  }

  // Đang chờ bổ sung: chưa có hạn, chỉ biết còn bao nhiêu khi tiếp tục; tình trạng theo phần còn lại đó (đã dùng hết trước khi dừng thì Quá hạn)
  if (runningSince === null) {
    const remainingMinutes = totalMinutes - usedMinutes;
    const state: DeadlineState = remainingMinutes <= 0 ? 'overdue' : remainingMinutes <= DUE_SOON_MINUTES ? 'dueSoon' : 'onTrack';
    return { state, maxDays, dueAt: null, remainingMinutes };
  }
  const dueAt = addWorkingMinutes(runningSince, totalMinutes - usedMinutes, holidays);

  // Đã Duyệt / Từ chối: so lúc ra quyết định với hạn
  const lastEvent = history.at(-1)!;
  if (lastEvent.status === 'duyet' || lastEvent.status === 'tc') {
    const decidedAt = ([...history].reverse().find((event) => event.action === 'approve' || event.action === 'reject') ?? lastEvent).at;
    const state: DeadlineState = decidedAt <= dueAt ? 'doneOnTime' : 'doneLate';
    return { state, maxDays, dueAt, remainingMinutes: minutesUntil(decidedAt, dueAt, holidays) };
  }

  // Chưa có kết quả: so bây giờ với hạn
  const remainingMinutes = minutesUntil(now, dueAt, holidays);
  const state: DeadlineState = now > dueAt ? 'overdue' : remainingMinutes <= DUE_SOON_MINUTES ? 'dueSoon' : 'onTrack';
  return { state, maxDays, dueAt, remainingMinutes };
}

/**
 * Câu nói thêm cạnh tình trạng hạn: còn bao lâu, trễ bao lâu.
 * @param deadline  hạn của lá đơn (formDeadline)
 * @returns         vd 'Còn 2 ngày 3 giờ', 'Trễ 5 giờ', 'Còn 3 ngày, tính tiếp khi bổ sung xong' (đang chờ bổ sung);
 *                  Không có hạn, Xong đúng hạn, hoặc trễ chỉ trong ngày nghỉ (chưa tốn giờ làm việc nào) thì null
 */
export function deadlineDetailText(deadline: FormDeadline): string | null {
  if (deadline.remainingMinutes === null) return null;
  const duration = workingDurationText(deadline.remainingMinutes);
  if (deadline.dueAt === null) return `${deadline.remainingMinutes > 0 ? 'Còn' : 'Trễ'} ${duration}, tính tiếp khi bổ sung xong`;
  if (deadline.state === 'onTrack' || deadline.state === 'dueSoon') return `Còn ${duration}`;
  return deadline.remainingMinutes < 0 ? `Trễ ${duration}` : null;
}

/* ---------- Thống kê ---------- */

/**
 * Đếm đơn theo tình trạng hạn (khung Theo tình trạng hạn ở trang Quản lí đơn).
 * @param states  tình trạng hạn của từng đơn
 * @returns       số đơn mỗi tình trạng (đủ mọi tình trạng, chưa có thì 0)
 */
export function countDeadlineStates(states: readonly DeadlineState[]): Record<DeadlineState, number> {
  const byDeadline = Object.fromEntries(DEADLINE_STATES.map((state) => [state, 0])) as Record<DeadlineState, number>;
  for (const state of states) byDeadline[state] += 1;
  return byDeadline;
}
