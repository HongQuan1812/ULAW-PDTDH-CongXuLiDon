/* Hạn xử lí của lá đơn: thời gian xử lí tối đa đặt ở loại đơn, tình trạng hạn và tên hiện.
   Cách tính hạn: xem business-rules/forms--deadlines.ts. Tình trạng hạn không phải trạng thái đơn, cổng tự tính, không ai bấm chuyển. */
import { z } from 'zod';

/** Thời gian xử lí tối đa đặt được, tính bằng ngày làm việc. */
export const MAX_PROCESSING_DAYS_LIMIT = 365;

/** Thời gian xử lí tối đa của một phiên bản loại đơn, tính bằng ngày làm việc; null = loại đơn không có hạn. */
export const MaxProcessingDaysSchema = z
  .number()
  .int('Thời gian xử lí tối đa phải là số nguyên.')
  .min(1, 'Thời gian xử lí tối đa ít nhất 1 ngày làm việc.')
  .max(MAX_PROCESSING_DAYS_LIMIT, `Thời gian xử lí tối đa không quá ${MAX_PROCESSING_DAYS_LIMIT} ngày làm việc.`)
  .nullable();

/**
 * onTrack: còn hơn 1 ngày làm việc · dueSoon: hôm nay là hạn, hoặc hạn là ngày làm việc kế tiếp · overdue: qua hạn, chưa có kết quả ·
 * paused: đang chờ người nộp bổ sung (hạn tạm dừng) · doneOnTime / doneLate: đã Duyệt / Từ chối, trước hoặc sau hạn
 */
export const DEADLINE_STATES = ['onTrack', 'dueSoon', 'overdue', 'paused', 'doneOnTime', 'doneLate'] as const;
export type DeadlineState = (typeof DEADLINE_STATES)[number];

/* Tên hiển thị. */
export const DEADLINE_STATE_LABEL: Record<DeadlineState, string> = {
  onTrack: 'Còn hạn',
  dueSoon: 'Sắp tới hạn',
  overdue: 'Quá hạn',
  paused: 'Tạm dừng',
  doneOnTime: 'Xong đúng hạn',
  doneLate: 'Xong trễ hạn',
};

/** Hạn xử lí của một lá đơn (máy chủ tính mỗi lần trả đơn). Loại đơn không có hạn thì đơn không có mục này. */
export const FormDeadlineSchema = z.object({
  state: z.enum(DEADLINE_STATES),
  /** Thời gian xử lí tối đa lúc nộp (theo bản chụp loại đơn), ngày làm việc */
  maxDays: z.number().int().positive(),
  /** Thời điểm hết hạn, giờ Việt Nam 'YYYY-MM-DDTHH:mm'; Tạm dừng thì null vì chưa biết sinh viên bổ sung lúc nào */
  dueAt: z.string().nullable(),
  /** Thời gian làm việc còn lại, tính bằng phút (mỗi ngày làm việc 24 giờ); âm = đã trễ bấy nhiêu.
      Tạm dừng: còn lại khi sinh viên bổ sung xong · Xong: còn dư (≥ 0) hay trễ (< 0) lúc ra quyết định */
  remainingMinutes: z.number().int(),
});
export type FormDeadline = z.infer<typeof FormDeadlineSchema>;
