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
 * onTrack: còn hơn 1 ngày làm việc · dueSoon: còn 1 ngày làm việc trở xuống · overdue: qua hạn, chưa có kết quả ·
 * doneOnTime / doneLate: đã Duyệt / Từ chối, trước hoặc sau hạn · none: loại đơn lúc nộp không giới hạn thời gian xử lí.
 * Đang chờ bổ sung thì đồng hồ dừng nhưng không có tình trạng riêng (trạng thái đơn Cần bổ sung đã nói điều đó):
 * xếp theo thời gian còn lại lúc dừng, như khi đồng hồ đang chạy.
 */
export const DEADLINE_STATES = ['onTrack', 'dueSoon', 'overdue', 'doneOnTime', 'doneLate', 'none'] as const;
export type DeadlineState = (typeof DEADLINE_STATES)[number];

/* Tên hiển thị. */
export const DEADLINE_STATE_LABEL: Record<DeadlineState, string> = {
  onTrack: 'Còn hạn',
  dueSoon: 'Sắp tới hạn',
  overdue: 'Quá hạn',
  doneOnTime: 'Xong đúng hạn',
  doneLate: 'Xong trễ hạn',
  none: 'Không có hạn',
};

/** Hạn xử lí của một lá đơn (máy chủ tính mỗi lần trả đơn). Đơn nào cũng có; loại đơn không giới hạn thì tình trạng 'none', các số null. */
export const FormDeadlineSchema = z.object({
  state: z.enum(DEADLINE_STATES),
  /** Thời gian xử lí tối đa lúc nộp (theo bản chụp loại đơn), ngày làm việc; null = không giới hạn */
  maxDays: z.number().int().positive().nullable(),
  /** Thời điểm hết hạn, giờ Việt Nam 'YYYY-MM-DDTHH:mm'; null khi không giới hạn, hoặc đang chờ bổ sung (chưa biết sinh viên bổ sung lúc nào) */
  dueAt: z.string().nullable(),
  /** Thời gian làm việc còn lại, tính bằng phút (mỗi ngày làm việc 24 giờ); âm = đã trễ bấy nhiêu.
      Đang chờ bổ sung: còn lại khi sinh viên bổ sung xong · Xong: còn dư (≥ 0) hay trễ (< 0) lúc ra quyết định · không giới hạn: null */
  remainingMinutes: z.number().int().nullable(),
});
export type FormDeadline = z.infer<typeof FormDeadlineSchema>;
