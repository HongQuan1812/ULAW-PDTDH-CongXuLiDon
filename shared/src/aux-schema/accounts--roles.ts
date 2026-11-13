/* Mã vai trò, quyền và trang của tài khoản.
   Vai trò nào có quyền gì, thấy trang nào: xem ROLES trong business-rules/accounts--permissions.ts. */

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
  'internalNotes', //      xem, viết ghi chú nội bộ trên lá đơn (người nộp đơn không thấy); sửa, xóa ghi chú của mình
  'manageAccounts', //     trang Quản lí tài khoản
  'manageFormTypes', //    trang Quản lí loại đơn
  'manageEmail', //        trang Cấu hình email: người gửi, bật / tắt và nội dung email báo khi đơn đổi trạng thái
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/* Các trang có trong menu. Tên trùng với thư mục trang trong web/src/pages/. */
export const PAGES = [
  'profile', //    Trang thông tin (hồ sơ cá nhân, đơn của mình)
  'forms', //      Quản lí đơn (tất cả đơn)
  'formTypes', // Quản lí loại đơn
  'accounts', //   Quản lí tài khoản
  'emailSettings', // Cấu hình email
] as const;
export type Page = (typeof PAGES)[number];

export const ROLE_IDS = ['nguoiNopDon', 'nguoiXuLiDon', 'admin'] as const;
export type RoleId = (typeof ROLE_IDS)[number];
