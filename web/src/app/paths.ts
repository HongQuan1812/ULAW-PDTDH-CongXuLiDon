/* Đường dẫn và tên hiển thị của các trang. Giữ như bản mẫu, vd #/quan-li-don. */
import { ROLES, type Page, type RoleId } from '@ulaw/shared';

export const LOGIN_PATH = '/dang-nhap';

export const PAGE_PATH: Record<Page, string> = {
  profile: '/thong-tin-ca-nhan',
  forms: '/quan-li-don',
  formTypes: '/quan-li-loai-don',
  accounts: '/quan-li-tai-khoan',
};

export const PAGE_LABEL: Record<Page, string> = {
  profile: 'Thông tin cá nhân',
  forms: 'Quản lí đơn',
  formTypes: 'Quản lí loại đơn',
  accounts: 'Quản lí tài khoản',
};

/**
 * Trang mở ra sau khi đăng nhập.
 * @param role  vai trò
 * @returns     đường dẫn trang chính của vai trò, vd '/quan-li-don'
 */
export function homePath(role: RoleId): string {
  return PAGE_PATH[ROLES[role].home];
}
