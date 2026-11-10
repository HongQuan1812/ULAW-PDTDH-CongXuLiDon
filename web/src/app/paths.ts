/* Đường dẫn và tên hiển thị của các trang. Giữ như bản mẫu, vd #/quan-li-don. */
import { ROLES, type Page, type RoleId } from '@ulaw/shared';

export const LOGIN_PATH = '/dang-nhap';
export const ONBOARDING_PATH = '/bo-sung-thong-tin';

export const PAGE_PATH: Record<Page, string> = {
  profile: '/thong-tin-ca-nhan',
  forms: '/quan-li-don',
  formTypes: '/quan-li-loai-don',
  accounts: '/quan-li-tai-khoan',
};

/** Trang nộp đơn mới, khai báo trong router: /nop-don/<mã loại đơn>. */
export const NEW_FORM_ROUTE = '/nop-don/:formTypeId';

/**
 * Đường dẫn trang nộp đơn mới của một loại đơn (mở sau khi chọn trong hộp "Chọn loại đơn").
 * @param formTypeId  mã loại đơn, vd 'xmm'
 * @returns           vd '/nop-don/xmm'
 */
export function newFormPath(formTypeId: string): string {
  return `/nop-don/${encodeURIComponent(formTypeId)}`;
}

/**
 * Đường dẫn trang chi tiết của một lá đơn.
 * @param code  mã đơn, vd 'XMM-2026-00001'
 * @returns     vd '/don/XMM-2026-00001'
 */
export function formPath(code: string): string {
  return `/don/${encodeURIComponent(code)}`;
}

/** state gửi kèm khi chuyển trang, để trang mới có nút "‹ Quay lại <trang trước>" (như routeLabel của artifact/js/nav.js). */
export interface ReturnState {
  /** tên trang trước, vd 'Thông tin cá nhân', 'đơn đang soạn' */
  previousPageLabel: string;
}

/**
 * Đọc tên trang trước từ state của trang (nếu trang trước có gửi kèm).
 * @param locationState  location.state của React Router
 * @returns              tên trang trước, hoặc undefined nếu không có
 */
export function readPreviousPageLabel(locationState: unknown): string | undefined {
  const previousPageLabel = (locationState as Partial<ReturnState> | null)?.previousPageLabel;
  return typeof previousPageLabel === 'string' ? previousPageLabel : undefined;
}

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
