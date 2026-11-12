/* Các lúc cổng gửi email báo cho người nộp đơn.
   Mỗi lúc ứng với một trạng thái đơn vừa chuyển tới; mã trạng thái như FORM_STATUSES. */
import type { FormStatus } from './forms--statuses';

/** Bốn lúc gửi email, theo thứ tự tab trên trang Cấu hình email: Đã nộp · Cần bổ sung · Từ chối · Đã duyệt. */
export const EMAIL_EVENT_STATUSES = ['nop', 'bs', 'tc', 'duyet'] as const satisfies readonly FormStatus[];
export type EmailEventStatus = (typeof EMAIL_EVENT_STATUSES)[number];
