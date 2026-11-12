/* Định dạng dữ liệu để hiện trên giao diện. Ngày, giờ, SĐT dùng chung với máy chủ (tìm kiếm trên đúng chữ đang hiện) nên nằm ở @ulaw/shared. */
import { formatDate } from '@ulaw/shared';

export { EMPTY_TEXT, formatDate, formatDateTime, formatPhone } from '@ulaw/shared';

/**
 * Chèn dấu "/" khi gõ ngày: chỉ giữ chữ số (tối đa 8), thêm "/" sau ngày và tháng khi đã gõ sang phần sau,
 * vd "1203" → "12/03", "12032026" → "12/03/2026". Xóa lùi qua dấu "/" vẫn được vì "/" chỉ thêm khi có số phía sau.
 * @param typedText  chữ người dùng đang gõ trong ô ngày
 * @returns          chữ dạng 'DD/MM/YYYY' (có thể chưa đủ)
 */
export function maskDateInput(typedText: string): string {
  const digits = typedText.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)];
  return parts.filter(Boolean).join('/');
}

/**
 * Đọc ngày dạng ngày/tháng/năm, vd "30/10/2026" → "2026-10-30". Ngày không có thật (vd 31/02/2026) thì không đọc được.
 * @param displayDate  ngày dạng 'DD/MM/YYYY'
 * @returns            ngày dạng 'YYYY-MM-DD'; không đúng dạng hoặc không có thật thì null
 */
export function parseDisplayDate(displayDate: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(displayDate.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const isRealDate = date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
  return isRealDate ? `${year}-${month}-${day}` : null;
}

/**
 * Kiểm tra chuỗi có phải ngày dạng 'YYYY-MM-DD' có thật không.
 * @param text  chuỗi cần kiểm tra
 * @returns     true nếu là ngày có thật
 */
export function isIsoDate(text: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && parseDisplayDate(formatDate(text)) === text;
}
