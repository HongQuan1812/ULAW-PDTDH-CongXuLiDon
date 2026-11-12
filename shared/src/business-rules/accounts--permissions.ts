/* Vai trò nào được làm gì (chuyển từ ROLES, can, canSee, canDecideOn trong artifact/js/config.js).
   Muốn thay đổi vai trò nào làm được gì, chỉ cần sửa ROLES ở đây (frontend và backend cùng dùng).
   Quy ước tên: form = lá đơn sinh viên nộp · form type = loại đơn (mẫu do cán bộ soạn). */
import type { Page, Permission, RoleId } from '../aux-schema/accounts--roles';
import type { FormStatus } from '../aux-schema/forms--statuses';
import { isDecidable, isEditable, isReceivable, isTransferable } from './forms--statuses';

export interface Role {
  name: string;
  /** Các trang được thấy trong menu. */
  pages: readonly Page[];
  /** Trang mở ra sau khi đăng nhập. */
  home: Page;
  permissions: readonly Permission[];
}

export const ROLES: Record<RoleId, Role> = {
  nguoiNopDon: {
    name: 'Người nộp đơn',
    pages: ['profile'],
    home: 'profile',
    permissions: ['submit', 'editOwn'],
  },
  nguoiXuLiDon: {
    name: 'Người xử lí đơn',
    pages: ['profile', 'forms', 'formTypes'],
    home: 'forms',
    permissions: ['submit', 'editOwn', 'viewAll', 'receive', 'viewApplicant', 'decide', 'transfer', 'manageFormTypes'],
  },
  admin: {
    name: 'Admin',
    pages: ['profile', 'forms', 'formTypes', 'accounts', 'emailSettings'],
    home: 'forms',
    permissions: [
      'manageFormTypes', 'submit', 'editOwn', 'viewAll', 'receive', 'viewApplicant', 'editApplicant',
      'submitForApplicant', 'decide', 'decideAny', 'transfer', 'editAnyForm', 'manageAccounts', 'manageEmail',
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

/**
 * Kiểm tra người dùng có được sửa nội dung một lá đơn hay không.
 * @param user  người dùng đang đăng nhập (cần id, role)
 * @param form  lá đơn (cần status, applicantId: id người nộp)
 * @returns     true khi đơn còn sửa được (Đã nộp / Cần bổ sung / Đã bổ sung), và: là đơn của mình (quyền editOwn)
 *              hoặc được sửa đơn người khác (quyền editAnyForm)
 */
export function canEditForm(
  user: { id: string; role: RoleId } | null | undefined,
  form: { status: FormStatus; applicantId: string },
): boolean {
  if (!user || !isEditable(form.status)) return false;
  return (form.applicantId === user.id && can(user.role, 'editOwn')) || can(user.role, 'editAnyForm');
}

/**
 * Kiểm tra người dùng có được bấm "Tiếp nhận" một lá đơn hay không.
 * @param role    vai trò người dùng; null / undefined = chưa đăng nhập
 * @param status  trạng thái lá đơn
 * @returns       true khi có quyền receive và đơn đang chờ tiếp nhận (Đã nộp / Đã bổ sung)
 */
export function canReceiveForm(role: RoleId | null | undefined, status: FormStatus): boolean {
  return can(role, 'receive') && isReceivable(status);
}

/**
 * Kiểm tra vai trò có được Chuyển giao một lá đơn cho người xử lí khác hay không.
 * @param role  vai trò người dùng; null / undefined = chưa đăng nhập
 * @param form  lá đơn (cần status, handler)
 * @returns     true khi có quyền transfer, đơn đã có người xử lí và đang ở trạng thái chuyển giao được (Đang xét / Cần bổ sung / Đã bổ sung);
 *              không cần là người xử lí của đơn
 */
export function canTransferForm(
  role: RoleId | null | undefined,
  form: { status: FormStatus; handler?: { email: string } | null },
): boolean {
  return can(role, 'transfer') && !!form.handler && isTransferable(form.status);
}

/**
 * Kiểm tra người dùng có được đổi vai trò của một tài khoản hay không.
 * Cần quyền manageAccounts, và không được đổi vai trò của chính mình (tránh tự khóa mình khỏi trang Quản lí tài khoản).
 * @param user           người dùng đang đăng nhập (cần id, role)
 * @param targetUserId   id tài khoản muốn đổi vai trò
 * @returns              true nếu được đổi
 */
export function canChangeAccountRole(user: { id: string; role: RoleId } | null | undefined, targetUserId: string): boolean {
  if (!user) return false;
  return can(user.role, 'manageAccounts') && user.id !== targetUserId;
}
