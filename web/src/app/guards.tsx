/* Chặn trang theo vai trò: trang không thuộc vai trò thì về trang chính, như renderRoute của bản mẫu. */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { can, canSeePage, type Page, type Permission } from '@ulaw/shared';
import { useAuth } from '../features/auth/useAuth';
import { homePath } from './paths';

/**
 * Chỉ hiện trang khi vai trò được thấy trang đó (và có quyền cần thiết, nếu có).
 * @param page        trang, vd 'accounts'
 * @param permission  quyền cần có thêm, vd 'manageAccounts' (không bắt buộc)
 * @param children    nội dung trang
 * @returns           nội dung trang, hoặc chuyển về trang chính của vai trò
 */
export function PageGuard({ page, permission, children }: { page: Page; permission?: Permission; children: ReactNode }) {
  const { role } = useAuth();
  const allowed = canSeePage(role, page) && (!permission || can(role, permission));
  return allowed ? children : <Navigate to={homePath(role)} replace />;
}

/**
 * Chuyển về trang chính của vai trò. Dùng cho '/' và đường dẫn không có.
 * @returns  chuyển trang
 */
export function HomeRedirect() {
  return <Navigate to={homePath(useAuth().role)} replace />;
}
