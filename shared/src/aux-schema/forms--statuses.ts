/* Trạng thái của lá đơn và tên hiện.
   Trạng thái nào làm được gì (sửa, tiếp nhận…): xem business-rules/forms--statuses.ts. */

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
