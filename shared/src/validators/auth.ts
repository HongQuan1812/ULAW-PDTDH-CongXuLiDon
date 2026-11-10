/* Kiểm tra khi đăng nhập: chỉ email trường mới được vào cổng.
   Backend thật: email Google trả về phải qua isSchoolEmail(), không thì trả 403 (AUTH_MESSAGES[403]) và không tạo phiên. */

/* Chỉ chấp nhận email thuộc các tên miền này (kể cả tên miền con, vd ...@student.hcmulaw.edu.vn).
   TODO: xác nhận lại tên miền email thật của sinh viên và cán bộ. */
export const SCHOOL_EMAIL_DOMAINS = ['hcmulaw.edu.vn'] as const;

/**
 * Kiểm tra email có thuộc tên miền của trường hay không (kể cả tên miền con).
 * @param email  địa chỉ email, vd "an.nv@student.hcmulaw.edu.vn"
 * @returns      true nếu tên miền trùng hoặc là tên miền con của một mục trong SCHOOL_EMAIL_DOMAINS
 */
export function isSchoolEmail(email: string): boolean {
  // Lấy phần tên miền sau dấu @, viết thường
  const domain = String(email).toLowerCase().split('@')[1] ?? '';

  // Trùng hẳn, hoặc kết thúc bằng ".<tên miền trường>"
  return SCHOOL_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));
}
