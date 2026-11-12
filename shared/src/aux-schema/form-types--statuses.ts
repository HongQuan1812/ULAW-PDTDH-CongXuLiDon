/* Trạng thái của loại đơn và tên hiện. */

export const FORM_TYPE_STATUSES = ['draft', 'open', 'closed'] as const;
export type FormTypeStatus = (typeof FORM_TYPE_STATUSES)[number];

export const FORM_TYPE_STATUS_LABEL: Record<FormTypeStatus, string> = {
  draft: 'Nháp', // người nộp đơn không thấy
  open: 'Đang mở', // nhận đơn
  closed: 'Đã đóng', // không nhận đơn mới
};
