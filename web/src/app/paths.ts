/* Đường dẫn và tên hiển thị của các trang. Giữ như bản mẫu, vd #/quan-li-don. */
import { ROLES, type Page, type RoleId } from '@ulaw/shared';

export const LOGIN_PATH = '/dang-nhap';
export const ONBOARDING_PATH = '/bo-sung-thong-tin';

export const PAGE_PATH: Record<Page, string> = {
  profile: '/thong-tin-ca-nhan',
  forms: '/quan-li-don',
  formTypes: '/quan-li-loai-don',
  accounts: '/quan-li-tai-khoan',
  emailSettings: '/cau-hinh-email',
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
 * @param code  mã đơn, vd 'XMM-2026-001-00001'
 * @returns     vd '/don/XMM-2026-001-00001'
 */
export function formPath(code: string): string {
  return `/don/${encodeURIComponent(code)}`;
}

/** Trình soạn loại đơn, khai báo trong router: /soan-don/<mã loại đơn> (như #soan-don-<mã> của bản mẫu). */
export const FORM_TYPE_EDITOR_ROUTE = '/soan-don/:formTypeId';

/** Mã loại đơn trên đường dẫn khi tạo loại đơn mới: /soan-don/moi. */
export const NEW_FORM_TYPE_ID = 'moi';

/** Tên tham số trên đường dẫn trình soạn để mở đúng một phiên bản: /soan-don/xmm?phien-ban=2. */
export const FORM_TYPE_VERSION_PARAM = 'phien-ban';

/**
 * Đường dẫn trình soạn của một loại đơn.
 * @param formTypeId  mã loại đơn, vd 'xmm'; tạo mới thì NEW_FORM_TYPE_ID
 * @param version     phiên bản muốn mở; bỏ trống thì mở phiên bản mới nhất
 * @returns           vd '/soan-don/xmm', '/soan-don/xmm?phien-ban=2'
 */
export function formTypeEditorPath(formTypeId: string, version?: number): string {
  const path = `/soan-don/${encodeURIComponent(formTypeId)}`;
  return version === undefined ? path : `${path}?${FORM_TYPE_VERSION_PARAM}=${version}`;
}

/** Trang hồ sơ người nộp đơn (chỉ xem), khai báo trong router: /ho-so/<id người dùng>. */
export const PERSON_PROFILE_ROUTE = '/ho-so/:userId';

/**
 * Đường dẫn trang hồ sơ của một người nộp đơn.
 * @param userId  id người dùng
 * @returns       vd '/ho-so/sv-2'
 */
export function personProfilePath(userId: string): string {
  return `/ho-so/${encodeURIComponent(userId)}`;
}

/** Trang nộp đơn mới thay cho người khác (như #nop-don-<id> của bản mẫu), khai báo trong router: /ho-so/<id>/nop-don/<mã loại đơn>. */
export const NEW_FORM_FOR_APPLICANT_ROUTE = '/ho-so/:userId/nop-don/:formTypeId';

/**
 * Đường dẫn trang nộp đơn mới thay cho một người nộp đơn.
 * @param userId      id người nộp đơn (đơn thuộc về người này)
 * @param formTypeId  mã loại đơn, vd 'xmm'
 * @returns           vd '/ho-so/sv-5/nop-don/xmm'
 */
export function newFormForApplicantPath(userId: string, formTypeId: string): string {
  return `${personProfilePath(userId)}${newFormPath(formTypeId)}`;
}

/** Tên trang thông tin người khác, hiện trên nút "‹ Quay lại …" của trang mở từ đó. */
export const PERSON_PROFILE_LABEL = 'Thông tin người nộp đơn';

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
  emailSettings: 'Cấu hình email',
};

/**
 * Trang mở ra sau khi đăng nhập.
 * @param role  vai trò
 * @returns     đường dẫn trang chính của vai trò, vd '/quan-li-don'
 */
export function homePath(role: RoleId): string {
  return PAGE_PATH[ROLES[role].home];
}
