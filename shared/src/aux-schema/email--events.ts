/* Các lúc cổng gửi email tự động.
   - Bốn lúc gửi cho người nộp đơn: mỗi lúc ứng với một trạng thái đơn vừa chuyển tới; mã trạng thái như FORM_STATUSES.
   - Ba lúc gửi cho cán bộ: nhắc sắp tới hạn, nhắc quá hạn (gửi người xử lí đơn), được chuyển giao (gửi người nhận đơn). */
import type { FormStatus } from './forms--statuses';

/** Bốn lúc gửi email cho người nộp đơn: Đã nộp · Cần bổ sung · Từ chối · Đã duyệt. */
export const EMAIL_EVENT_STATUSES = ['nop', 'bs', 'tc', 'duyet'] as const satisfies readonly FormStatus[];
export type EmailEventStatus = (typeof EMAIL_EVENT_STATUSES)[number];

/** Ba lúc gửi email cho cán bộ: nhắc sắp tới hạn · nhắc quá hạn · được chuyển giao. */
export const STAFF_EMAIL_EVENTS = ['dueSoon', 'overdue', 'transferred'] as const;
export type StaffEmailEvent = (typeof STAFF_EMAIL_EVENTS)[number];

/** Bảy lúc gửi email, theo thứ tự tab trên trang Cấu hình email: thư cho người nộp đơn trước, thư cho cán bộ sau. */
export const EMAIL_EVENT_KINDS = [...EMAIL_EVENT_STATUSES, ...STAFF_EMAIL_EVENTS] as const;
export type EmailEventKind = (typeof EMAIL_EVENT_KINDS)[number];

/** Tên tab của từng lúc gửi. */
export const EMAIL_EVENT_LABEL: Record<EmailEventKind, string> = {
  nop: 'Đã nộp',
  bs: 'Cần bổ sung',
  tc: 'Từ chối',
  duyet: 'Đã duyệt',
  dueSoon: 'Nhắc sắp tới hạn',
  overdue: 'Nhắc quá hạn',
  transferred: 'Được chuyển giao',
};

/** Ai nhận thư của từng lúc gửi (không cấu hình được, chỉ ghi ra cho rõ). */
export const EMAIL_EVENT_RECIPIENT: Record<EmailEventKind, string> = {
  nop: 'người nộp đơn',
  bs: 'người nộp đơn',
  tc: 'người nộp đơn',
  duyet: 'người nộp đơn',
  dueSoon: 'người xử lí đơn; đơn chưa tiếp nhận thì gửi mọi Admin',
  overdue: 'người xử lí đơn; đơn chưa tiếp nhận thì gửi mọi Admin',
  transferred: 'người nhận đơn',
};

/**
 * Lúc gửi này là thư cho cán bộ hay cho người nộp đơn.
 * @param kind  lúc gửi
 * @returns     true nếu là thư cho cán bộ (nhắc hạn, chuyển giao)
 */
export function isStaffEmailEvent(kind: EmailEventKind): kind is StaffEmailEvent {
  return (STAFF_EMAIL_EVENTS as readonly string[]).includes(kind);
}
