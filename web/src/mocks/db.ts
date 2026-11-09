/* Dữ liệu giả của API giả, giữ trong bộ nhớ trình duyệt. */
import type { RoleId, Session, SessionUser } from '@ulaw/shared';

/* Tài khoản mẫu để đăng nhập thử: mỗi vai trò một người (lấy từ artifact/js/auth.js và sample-data.js). */
export const DEMO_USERS: Record<RoleId, SessionUser> = {
  'nguoi-nop-don': { id: 'sv-1', email: 'minhanh.nguyen@hcmulaw.edu.vn', name: 'Nguyễn Minh Anh' },
  'nguoi-xu-li-don': { id: 'cb-1', email: 'thuha.pham.pdt@hcmulaw.edu.vn', name: 'Phạm Thu Hà' },
  admin: { id: 'cb-3', email: 'ngocdiep.le.pdt@hcmulaw.edu.vn', name: 'Lê Ngọc Diệp' },
};

/* Vai trò đang đăng nhập, lưu trong sessionStorage để tải lại trang không bị đăng xuất
   (giống cookie phiên của backend thật). Đóng tab là mất. */
const SESSION_KEY = 'mock-session-role';

/**
 * Đọc phiên đăng nhập giả hiện tại.
 * @returns  phiên (người dùng + vai trò); chưa đăng nhập thì null
 */
export function readSession(): Session | null {
  // Đọc vai trò đã lưu (trình duyệt chặn bộ nhớ thì coi như chưa đăng nhập)
  let role: string | null = null;
  try {
    role = sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }

  // Vai trò không hợp lệ thì coi như chưa đăng nhập
  if (!role || !(role in DEMO_USERS)) return null;
  const roleId = role as RoleId;
  return { user: DEMO_USERS[roleId], role: roleId };
}

/**
 * Ghi hoặc xóa phiên đăng nhập giả.
 * @param role  vai trò đăng nhập; null = đăng xuất
 */
export function writeSession(role: RoleId | null): void {
  try {
    if (role) sessionStorage.setItem(SESSION_KEY, role);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Trình duyệt chặn bộ nhớ: phiên chỉ không giữ được khi tải lại trang
  }
}
