/* Các việc ghi vào lịch sử của lá đơn và tên hiện.
   Mỗi lần nộp, sửa, tiếp nhận, ra quyết định, chuyển giao là một dòng lịch sử. */

/**
 * submit: nộp đơn · edit: sửa đơn (trạng thái không đổi) · supplement: sửa đơn Cần bổ sung (sang Đã bổ sung) ·
 * receive: tiếp nhận · requestSupplement / approve / reject: ra quyết định · transfer: chuyển giao
 */
export const FORM_EVENT_ACTIONS = ['submit', 'edit', 'supplement', 'receive', 'requestSupplement', 'approve', 'reject', 'transfer'] as const;
export type FormEventAction = (typeof FORM_EVENT_ACTIONS)[number];

/* Tên hiển thị trên dòng thời gian Lịch sử. */
export const FORM_EVENT_LABEL: Record<FormEventAction, string> = {
  submit: 'Nộp đơn',
  edit: 'Sửa đơn',
  supplement: 'Bổ sung đơn',
  receive: 'Tiếp nhận',
  requestSupplement: 'Yêu cầu bổ sung',
  approve: 'Duyệt',
  reject: 'Từ chối',
  transfer: 'Chuyển giao',
};
