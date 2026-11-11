/* Bản soạn loại đơn chưa lưu, giữ trong bộ nhớ (như formDrafts của artifact/js/forms-page.js):
   đi trang khác rồi quay lại trình soạn thì vẫn còn các thay đổi, cho đến khi Lưu hoặc Bỏ thay đổi. Tải lại trang thì mất.
   Bấm "+ Tạo loại đơn" thì bắt đầu bản trống (bỏ bản tạo mới đang dở). */
import type { FormTypeDraft } from './formTypeDraft';

/** Bản soạn theo mã loại đơn; tạo mới dùng NEW_FORM_TYPE_ID. Chỉ giữ bản có thay đổi chưa lưu. */
const draftsByFormType = new Map<string, FormTypeDraft>();

/**
 * Lấy bản soạn chưa lưu của một loại đơn.
 * @param formTypeId  mã loại đơn, hoặc NEW_FORM_TYPE_ID
 * @returns           bản soạn, hoặc undefined nếu không có thay đổi chưa lưu
 */
export function readFormTypeDraft(formTypeId: string): FormTypeDraft | undefined {
  return draftsByFormType.get(formTypeId);
}

/**
 * Giữ bản soạn chưa lưu (ghi đè bản cũ).
 * @param formTypeId  mã loại đơn, hoặc NEW_FORM_TYPE_ID
 * @param draft       bản đang soạn
 */
export function keepFormTypeDraft(formTypeId: string, draft: FormTypeDraft): void {
  draftsByFormType.set(formTypeId, draft);
}

/**
 * Bỏ bản soạn chưa lưu (đã lưu, bỏ thay đổi, đã xóa loại đơn, hoặc bắt đầu tạo mới).
 * @param formTypeId  mã loại đơn, hoặc NEW_FORM_TYPE_ID
 */
export function discardFormTypeDraft(formTypeId: string): void {
  draftsByFormType.delete(formTypeId);
}

/**
 * Loại đơn có thay đổi chưa lưu không (để bảng Quản lí loại đơn ghi chú).
 * @param formTypeId  mã loại đơn
 * @returns           true nếu có
 */
export function hasFormTypeDraft(formTypeId: string): boolean {
  return draftsByFormType.has(formTypeId);
}
