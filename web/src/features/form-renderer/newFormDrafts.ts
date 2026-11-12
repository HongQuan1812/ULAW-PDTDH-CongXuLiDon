/* Bản nháp của lá đơn mới đang soạn, giữ trong bộ nhớ:
   rời trang nộp đơn (vd bấm "Xem hồ sơ ›") rồi quay lại bằng nút Quay lại / Back thì vẫn còn câu đã điền.
   Mở trang nộp đơn bằng "Nộp đơn mới" thì bắt đầu đơn trống. Tải lại trang thì mất nháp. */
import type { FormAnswers } from '@ulaw/shared';

/** Nháp của một lá đơn: câu trả lời và ô cam đoan. */
export interface NewFormDraft {
  answers: FormAnswers;
  committed: boolean;
}

/** Nháp theo mã loại đơn; mỗi loại đơn một nháp. */
const draftsByFormType = new Map<string, NewFormDraft>();

/**
 * Lấy nháp đã giữ của một loại đơn.
 * @param formTypeId  mã loại đơn
 * @returns           nháp, hoặc undefined nếu chưa có
 */
export function readNewFormDraft(formTypeId: string): NewFormDraft | undefined {
  return draftsByFormType.get(formTypeId);
}

/**
 * Giữ nháp của một loại đơn (ghi đè nháp cũ).
 * @param formTypeId  mã loại đơn
 * @param draft       câu trả lời và ô cam đoan hiện tại
 */
export function keepNewFormDraft(formTypeId: string, draft: NewFormDraft): void {
  draftsByFormType.set(formTypeId, draft);
}

/**
 * Bỏ nháp của một loại đơn (vd đã gửi đơn xong).
 * @param formTypeId  mã loại đơn
 */
export function discardNewFormDraft(formTypeId: string): void {
  draftsByFormType.delete(formTypeId);
}
