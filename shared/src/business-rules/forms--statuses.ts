/* Luật theo trạng thái lá đơn: trạng thái nào thì sửa được, tiếp nhận được, chuyển giao được, ra quyết định được
   (chuyển từ EDITABLE, RECEIVABLE, TRANSFERABLE, DECIDABLE trong artifact/js/config.js). */
import type { FormStatus } from '../aux-schema/forms--statuses';

/** Người nộp sửa được đơn. */
export const EDITABLE: readonly FormStatus[] = ['nop', 'bs', 'bsg'];
/** Phòng Đào tạo bấm được "Tiếp nhận". */
export const RECEIVABLE: readonly FormStatus[] = ['nop', 'bsg'];
/** Chuyển giao được: đã tiếp nhận, chưa có kết quả. */
export const TRANSFERABLE: readonly FormStatus[] = ['xet', 'bs', 'bsg'];
/** Cán bộ bấm được Yêu cầu bổ sung / Duyệt / Từ chối. */
export const DECIDABLE: readonly FormStatus[] = ['xet'];

/**
 * Đơn ở trạng thái này người nộp còn sửa được không.
 * @param status  trạng thái lá đơn
 * @returns       true nếu status thuộc EDITABLE
 */
export function isEditable(status: FormStatus): boolean {
  return EDITABLE.includes(status);
}

/**
 * Đơn ở trạng thái này Phòng Đào tạo bấm "Tiếp nhận" được không.
 * @param status  trạng thái lá đơn
 * @returns       true nếu status thuộc RECEIVABLE
 */
export function isReceivable(status: FormStatus): boolean {
  return RECEIVABLE.includes(status);
}

/**
 * Đơn ở trạng thái này chuyển giao cho người xử lí khác được không.
 * @param status  trạng thái lá đơn
 * @returns       true nếu status thuộc TRANSFERABLE
 */
export function isTransferable(status: FormStatus): boolean {
  return TRANSFERABLE.includes(status);
}

/**
 * Đơn ở trạng thái này ra quyết định (Yêu cầu bổ sung / Duyệt / Từ chối) được không.
 * @param status  trạng thái lá đơn
 * @returns       true nếu status thuộc DECIDABLE
 */
export function isDecidable(status: FormStatus): boolean {
  return DECIDABLE.includes(status);
}
