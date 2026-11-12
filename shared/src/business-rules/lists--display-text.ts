/* Chữ hiện trong ô bảng và cách so khớp khi tìm kiếm. Máy chủ tìm trên đúng chữ người dùng thấy,
   nên trình duyệt (hiện) và máy chủ (tìm, lọc) cùng dùng các hàm này. */

/** Hiện thay cho ô chưa có dữ liệu. */
export const EMPTY_TEXT = '—';

/**
 * Đưa chữ về dạng để so khớp: bỏ dấu tiếng Việt, đ → d, chữ thường.
 * Giữ nguyên số ký tự (với chữ đã dựng sẵn dạng NFC), nên vị trí tìm được dùng lại được trên chữ gốc.
 * @param text  chữ gốc, vd "Đã nộp"
 * @returns     chữ đã chuẩn hóa, vd "da nop"
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

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
 * Đổi thời điểm sang dạng giờ · ngày, vd "2026-10-30T07:05" → "07:05 · 30/10/2026".
 * @param isoDateTime  thời điểm dạng 'YYYY-MM-DDTHH:mm'
 * @returns            chuỗi 'HH:mm · DD/MM/YYYY'
 */
export function formatDateTime(isoDateTime: string): string {
  const [date = '', time = ''] = isoDateTime.split('T');
  return `${time.slice(0, 5)} · ${formatDate(date)}`;
}
