/* Người đang đăng nhập và quyền của họ, dùng trong các trang sau khi đăng nhập. */
import { can, canSeePage, type Page, type Permission, type Session } from '@ulaw/shared';
import { useSession } from '../../api/auth';

/**
 * Phiên đăng nhập hiện tại. Chỉ dùng bên trong khung ứng dụng (AppLayout đã chặn người chưa đăng nhập).
 * @returns  phiên (user, role); không bao giờ null
 */
export function useAuth(): Session {
  const { data } = useSession();
  if (!data) throw new Error('useAuth chỉ dùng được sau khi đã đăng nhập.');
  return data;
}

/**
 * Người đang đăng nhập có một quyền hay không.
 * @param permission  quyền cần kiểm tra, vd 'receive'
 * @returns           true nếu có quyền
 */
export function useCan(permission: Permission): boolean {
  return can(useAuth().role, permission);
}

/**
 * Người đang đăng nhập có được thấy một trang hay không.
 * @param page  trang cần kiểm tra, vd 'accounts'
 * @returns     true nếu trang có trong menu của vai trò
 */
export function useCanSeePage(page: Page): boolean {
  return canSeePage(useAuth().role, page);
}
