/* Bản soạn loại đơn chưa lưu, giữ trong bộ nhớ (như formDrafts của artifact/js/forms-page.js):
   đi trang khác rồi quay lại trình soạn thì vẫn còn các thay đổi, cho đến khi Lưu hoặc Bỏ thay đổi. Tải lại trang thì mất.
   Bấm "+ Tạo loại đơn" thì bắt đầu bản trống (bỏ bản tạo mới đang dở).
   Thay đổi về mẫu xuất file (thuộc loại đơn, không theo phiên bản) giữ riêng, cùng cách. */
import { hasTemplateChanges, type ExportTemplateChanges } from './exportTemplateChanges';
import type { FormTypeDraft } from './formTypeDraft';

/** Các thay đổi chưa lưu của một loại đơn: đang sửa phiên bản nào, và bản soạn. Mỗi loại đơn chỉ sửa một phiên bản một lúc. */
export interface UnsavedEdit {
  /** Số phiên bản đang sửa (phiên bản Nháp đã lưu, hoặc phiên bản mới sẽ tạo) */
  version: number;
  /** true: phiên bản mới, chưa có trên máy chủ (tạo loại đơn mới, hoặc chép từ phiên bản đã khóa) */
  isNewVersion: boolean;
  /** Phiên bản đã khóa được chép ra khi tạo phiên bản mới; còn lại null */
  baseVersion: number | null;
  /** Bản soạn lúc bắt đầu sửa (bản đã lưu / bản chép ra / bản trống); sửa về đúng như bản này thì coi như không còn thay đổi */
  baseDraft: FormTypeDraft;
  draft: FormTypeDraft;
}

/** Thay đổi chưa lưu theo mã loại đơn; tạo mới dùng NEW_FORM_TYPE_ID. */
const editsByFormType = new Map<string, UnsavedEdit>();

/** Thay đổi chưa lưu về mẫu xuất file theo mã loại đơn; tạo mới dùng NEW_FORM_TYPE_ID. */
const templateChangesByFormType = new Map<string, ExportTemplateChanges>();

/**
 * Lấy thay đổi chưa lưu của một loại đơn.
 * @param formTypeId  mã loại đơn, hoặc NEW_FORM_TYPE_ID
 * @returns           thay đổi chưa lưu, hoặc undefined nếu không có
 */
export function readUnsavedEdit(formTypeId: string): UnsavedEdit | undefined {
  return editsByFormType.get(formTypeId);
}

/**
 * Giữ thay đổi chưa lưu (ghi đè bản cũ).
 * @param formTypeId  mã loại đơn, hoặc NEW_FORM_TYPE_ID
 * @param edit        thay đổi hiện tại
 */
export function keepUnsavedEdit(formTypeId: string, edit: UnsavedEdit): void {
  editsByFormType.set(formTypeId, edit);
}

/**
 * Bỏ thay đổi chưa lưu (đã lưu, bỏ thay đổi, đã xóa, hoặc bắt đầu tạo mới).
 * @param formTypeId  mã loại đơn, hoặc NEW_FORM_TYPE_ID
 */
export function discardUnsavedEdit(formTypeId: string): void {
  editsByFormType.delete(formTypeId);
}

/**
 * Lấy thay đổi chưa lưu về mẫu xuất file của một loại đơn.
 * @param formTypeId  mã loại đơn, hoặc NEW_FORM_TYPE_ID
 * @returns           các thay đổi, hoặc undefined nếu không có
 */
export function readTemplateChanges(formTypeId: string): ExportTemplateChanges | undefined {
  return templateChangesByFormType.get(formTypeId);
}

/**
 * Giữ thay đổi về mẫu xuất file (ghi đè bản cũ); không còn thay đổi nào thì bỏ.
 * @param formTypeId  mã loại đơn, hoặc NEW_FORM_TYPE_ID
 * @param changes     các thay đổi hiện tại
 */
export function keepTemplateChanges(formTypeId: string, changes: ExportTemplateChanges): void {
  if (hasTemplateChanges(changes)) templateChangesByFormType.set(formTypeId, changes);
  else templateChangesByFormType.delete(formTypeId);
}

/**
 * Bỏ thay đổi về mẫu xuất file (đã lưu, bỏ thay đổi, đã xóa loại đơn, hoặc bắt đầu tạo mới).
 * @param formTypeId  mã loại đơn, hoặc NEW_FORM_TYPE_ID
 */
export function discardTemplateChanges(formTypeId: string): void {
  templateChangesByFormType.delete(formTypeId);
}

/**
 * Loại đơn có thay đổi chưa lưu không, kể cả về mẫu xuất file (để bảng Quản lí loại đơn ghi chú).
 * @param formTypeId  mã loại đơn
 * @returns           true nếu có
 */
export function hasUnsavedEdit(formTypeId: string): boolean {
  return editsByFormType.has(formTypeId) || templateChangesByFormType.has(formTypeId);
}
