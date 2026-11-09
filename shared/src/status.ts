/* Trạng thái của lá đơn và loại đơn.
   Chuyển từ STATUS, FORM_STATUS, EDITABLE, RECEIVABLE, TRANSFERABLE, DECIDABLE trong artifact/js/config.js.
   Quy ước tên: form = lá đơn sinh viên nộp · form type = loại đơn (mẫu do cán bộ soạn). */

/* ---------- Lá đơn ---------- */

export const FORM_STATUSES = ['nop', 'xet', 'bs', 'bsg', 'duyet', 'tc'] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

/* Tên hiển thị. Màu của từng trạng thái nằm ở web/src/styles/tokens.css (--s-<mã>-bg / --s-<mã>-fg). */
export const FORM_STATUS_LABEL: Record<FormStatus, string> = {
  nop: 'Đã nộp',
  xet: 'Đang xét',
  bs: 'Cần bổ sung',
  bsg: 'Đã bổ sung', // sinh viên đã sửa đơn "Cần bổ sung"; xử lí giống "Đã nộp"
  duyet: 'Đã duyệt',
  tc: 'Từ chối',
};

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

/* ---------- Loại đơn ---------- */

export const FORM_TYPE_STATUSES = ['draft', 'open', 'closed'] as const;
export type FormTypeStatus = (typeof FORM_TYPE_STATUSES)[number];

export const FORM_TYPE_STATUS_LABEL: Record<FormTypeStatus, string> = {
  draft: 'Nháp', // người nộp đơn không thấy
  open: 'Đang mở', // nhận đơn
  closed: 'Đã đóng', // không nhận đơn mới
};
