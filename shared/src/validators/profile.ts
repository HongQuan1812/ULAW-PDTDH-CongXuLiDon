/* Kiểm tra dữ liệu hồ sơ cá nhân: họ tên, CCCD, số điện thoại. */

/* ---------- Họ tên, CCCD, số điện thoại (chuyển từ `rx` trong artifact/js/auth.js) ---------- */

/** Câu báo lỗi khi họ tên, CCCD, số điện thoại không hợp lệ (hiện dưới ô nhập). */
export const VALIDATION_MESSAGES = {
  fullName: 'Nhập đầy đủ họ và tên.',
  cccd: 'Số CCCD gồm đúng 12 chữ số và bắt đầu bằng 0.',
  phone: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.',
} as const;

/** CCCD: đúng 12 chữ số, bắt đầu bằng 0. */
export const CCCD_PATTERN = /^0\d{11}$/;
/** Số điện thoại: 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09. */
export const PHONE_PATTERN = /^0(3|5|7|8|9)\d{8}$/;

/**
 * Kiểm tra họ và tên đã đầy đủ chưa.
 * @param name  họ và tên, vd "Nguyễn Minh Anh"
 * @returns     true nếu có từ 2 chữ trở lên (bỏ khoảng trắng đầu và cuối)
 */
export function isFullName(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}

/**
 * Kiểm tra số CCCD.
 * @param cccd  chuỗi cần kiểm tra
 * @returns     true nếu đúng 12 chữ số và bắt đầu bằng 0
 */
export function isValidCccd(cccd: string): boolean {
  return CCCD_PATTERN.test(cccd);
}

/**
 * Kiểm tra số điện thoại.
 * @param phone  chuỗi cần kiểm tra
 * @returns      true nếu đúng 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09
 */
export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone);
}

/**
 * Che số CCCD để hiện mặc định (CCCD là dữ liệu nhạy cảm).
 * @param cccd  số CCCD đầy đủ; null hoặc rỗng nếu chưa có
 * @returns     3 số đầu + "•••••" + 4 số cuối, vd "079•••••1234"; chưa có CCCD thì null
 */
export function maskCccd(cccd: string | null): string | null {
  if (!cccd) return null;
  return cccd.slice(0, 3) + '•••••' + cccd.slice(-4);
}
