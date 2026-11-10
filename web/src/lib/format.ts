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
