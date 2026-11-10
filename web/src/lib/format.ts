/* Định dạng dữ liệu để hiện trên giao diện. */

/** Hiện thay cho ô chưa có dữ liệu. */
export const EMPTY_TEXT = '—';

/**
 * Tách số điện thoại thành nhóm cho dễ đọc, vd "0901234567" → "0901 234 567".
 * @param phone  số điện thoại 10 chữ số; null nếu chưa có
 * @returns      số đã tách nhóm; chưa có thì "—"
 */
export function formatPhone(phone: string | null): string {
  if (!phone) return EMPTY_TEXT;
  return phone.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
}

/**
 * Đổi ngày sang dạng ngày/tháng/năm, vd "2026-10-30" (hoặc "2026-10-30T07:00") → "30/10/2026".
 * @param isoDateTime  ngày dạng 'YYYY-MM-DD', có thể kèm giờ phía sau
 * @returns            ngày dạng 'DD/MM/YYYY'
 */
export function formatDate(isoDateTime: string): string {
  return isoDateTime.slice(0, 10).split('-').reverse().join('/');
}

/**
 * Đổi thời điểm sang dạng giờ · ngày, như bản mẫu, vd "2026-10-30T07:05" → "07:05 · 30/10/2026".
 * @param isoDateTime  thời điểm dạng 'YYYY-MM-DDTHH:mm'
 * @returns            chuỗi 'HH:mm · DD/MM/YYYY'
 */
export function formatDateTime(isoDateTime: string): string {
  const [date = '', time = ''] = isoDateTime.split('T');
  return `${time.slice(0, 5)} · ${formatDate(date)}`;
}
