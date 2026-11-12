/* Hàm thời gian dùng khi dựng dữ liệu mẫu (không phụ thuộc múi giờ của máy chạy, trừ dateText). */

/** Thêm số 0 phía trước cho đủ 2 chữ số, vd 7 → "07". */
export const twoDigits = (number: number) => String(number).padStart(2, '0');

/** Ngày dạng 'YYYY-MM-DD' theo giờ máy. */
export const dateText = (day: Date) => `${day.getFullYear()}-${twoDigits(day.getMonth() + 1)}-${twoDigits(day.getDate())}`;

/**
 * Cộng thêm số giờ vào một thời điểm, không phụ thuộc múi giờ của máy.
 * @param dateTime  thời điểm 'YYYY-MM-DDTHH:mm'
 * @param hours     số giờ cộng thêm
 * @returns         thời điểm mới cùng dạng, vd ('2026-10-30T07:00', 27) → '2026-10-31T10:00'
 */
export function addHours(dateTime: string, hours: number): string {
  return new Date(Date.parse(`${dateTime}:00Z`) + hours * 3_600_000).toISOString().slice(0, 16);
}
