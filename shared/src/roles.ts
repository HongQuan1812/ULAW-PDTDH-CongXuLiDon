/* Vai trò và quyền. Chuyển từ ROLES, can, canSee, canDecideOn trong artifact/js/config.js.
   Muốn thay đổi vai trò nào làm được gì, chỉ cần sửa ROLES ở đây (frontend và backend cùng dùng).
   Quy ước tên: form = lá đơn sinh viên nộp · form type = loại đơn (mẫu do cán bộ soạn). */
import { isDecidable, type FormStatus } from './status';

export const PERMISSIONS = [
  'submit', //             nộp đơn mới
  'editOwn', //            sửa đơn của mình khi còn sửa được
  'viewAll', //            xem tất cả đơn ở trang Quản lí đơn
  'receive', //            bấm "Tiếp nhận" đơn
  'viewApplicant', //      xem trang thông tin của người nộp đơn
  'editApplicant', //      sửa thông tin của người nộp đơn
  'submitForApplicant', // nộp đơn mới thay cho người nộp đơn
  'decide', //             Yêu cầu bổ sung / Duyệt / Từ chối đơn Đang xét mà mình là người xử lí
  'decideAny', //          làm việc đó trên đơn người khác phụ trách
  'transfer', //           chuyển giao đơn cho người xử lí khác
  'editAnyForm', //        sửa nội dung đơn của người khác (cùng điều kiện EDITABLE)
  'manageAccounts', //     trang Quản lí tài khoản
  'manageFormTypes', //    trang Quản lí loại đơn
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/* Các trang có trong menu. Tên trùng với thư mục trang trong web/src/pages/. */
export const PAGES = [
  'profile', //    Trang thông tin (hồ sơ cá nhân, đơn của mình)
  'forms', //      Quản lí đơn (tất cả đơn)
  'formTypes', // Quản lí loại đơn
  'accounts', //   Quản lí tài khoản
] as const;
export type Page = (typeof PAGES)[number];

export const ROLE_IDS = ['nguoi-nop-don', 'nguoi-xu-li-don', 'admin'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export interface Role {
  name: string;
  /** Các trang được thấy trong menu. */
  pages: readonly Page[];
  /** Trang mở ra sau khi đăng nhập. */
  home: Page;
  permissions: readonly Permission[];
}

export const ROLES: Record<RoleId, Role> = {
  'nguoi-nop-don': {
    name: 'Người nộp đơn',
    pages: ['profile'],
    home: 'profile',
    permissions: ['submit', 'editOwn'],
  },
  'nguoi-xu-li-don': {
    name: 'Người xử lí đơn',
    pages: ['profile', 'forms', 'formTypes'],
    home: 'forms',
    permissions: ['submit', 'editOwn', 'viewAll', 'receive', 'viewApplicant', 'decide', 'transfer', 'manageFormTypes'],
  },
  admin: {
    name: 'Admin',
    pages: ['profile', 'forms', 'formTypes', 'accounts'],
    home: 'forms',
    permissions: [
      'manageFormTypes', 'submit', 'editOwn', 'viewAll', 'receive', 'viewApplicant', 'editApplicant',
      'submitForApplicant', 'decide', 'decideAny', 'transfer', 'editAnyForm', 'manageAccounts',
    ],
  },
};

/**
 * Kiểm tra vai trò có một quyền hay không.
 * @param role        vai trò; null / undefined = chưa đăng nhập
 * @param permission  quyền cần kiểm tra, vd 'receive'
 * @returns           true nếu vai trò có quyền đó; chưa đăng nhập luôn false
 */
export function can(role: RoleId | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLES[role].permissions.includes(permission);
}

/**
 * Kiểm tra vai trò có được thấy một trang trong menu hay không.
 * @param role  vai trò; null / undefined = chưa đăng nhập
 * @param page  trang cần kiểm tra, vd 'forms'
 * @returns     true nếu trang có trong danh sách pages của vai trò; chưa đăng nhập luôn false
 */
export function canSeePage(role: RoleId | null | undefined, page: Page): boolean {
  if (!role) return false;
  return ROLES[role].pages.includes(page);
}

/**
 * Kiểm tra người dùng có phải người xử lí của đơn hay không.
 * @param user  người dùng đang đăng nhập (cần email)
 * @param form  lá đơn (cần handler: người đang xử lí)
 * @returns     true nếu đơn có người xử lí và trùng email với người dùng
 */
export function isHandlerOf(
  user: { email: string } | null | undefined,
  form: { handler?: { email: string } | null },
): boolean {
  if (!user || !form.handler) return false;
  return form.handler.email === user.email;
}

/**
 * Kiểm tra người dùng có được Yêu cầu bổ sung / Duyệt / Từ chối một lá đơn hay không.
 * @param user  người dùng đang đăng nhập (cần email, role)
 * @param form  lá đơn (cần status, handler)
 * @returns     true khi: có quyền decide, đơn đang xét, và mình là người xử lí (hoặc có quyền decideAny)
 */
export function canDecideOn(
  user: { email: string; role: RoleId } | null | undefined,
  form: { status: FormStatus; handler?: { email: string } | null },
): boolean {
  // Chưa đăng nhập, không có quyền ra quyết định, hoặc đơn không ở trạng thái Đang xét
  if (!user || !can(user.role, 'decide') || !isDecidable(form.status)) return false;

  // Là người xử lí của đơn, hoặc được quyết định thay người khác
  return isHandlerOf(user, form) || can(user.role, 'decideAny');
}
