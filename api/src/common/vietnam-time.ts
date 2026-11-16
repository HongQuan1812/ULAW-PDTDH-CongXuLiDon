/* Đổi thời điểm trong database (UTC) sang giờ Việt Nam theo dạng hợp đồng API dùng. */

const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/**
 * Đổi một thời điểm sang giờ Việt Nam (UTC+7).
 * @param moment  thời điểm lấy từ database
 * @returns       chuỗi 'YYYY-MM-DDTHH:mm', vd 2026-10-30T00:00Z → '2026-10-30T07:00'
 */
export function toVietnamTime(moment: Date): string {
  return toVietnamSeconds(moment).slice(0, 16);
}

/**
 * Đổi một thời điểm sang giờ Việt Nam, tới giây.
 * @param moment  thời điểm
 * @returns       chuỗi 'YYYY-MM-DDTHH:mm:ss'
 */
export function toVietnamSeconds(moment: Date): string {
  return new Date(moment.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 19);
}

/**
 * Đổi giờ Việt Nam dạng chữ về thời điểm.
 * @param vietnamTime  'YYYY-MM-DDTHH:mm' (có thể kèm giây)
 * @returns            thời điểm (UTC)
 */
export function fromVietnamTime(vietnamTime: string): Date {
  return new Date(Date.parse(`${vietnamTime.length === 16 ? `${vietnamTime}:00` : vietnamTime}Z`) - VIETNAM_OFFSET_MS);
}
