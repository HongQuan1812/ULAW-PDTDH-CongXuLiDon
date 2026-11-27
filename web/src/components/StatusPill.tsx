import { DEADLINE_STATE_LABEL, FORM_STATUS_LABEL, FORM_TYPE_STATUS_LABEL, type DeadlineState, type FormStatus, type FormTypeStatus } from '@ulaw/shared';
import { Highlight } from './table/Highlight';
import styles from './StatusPill.module.css';

/**
 * Nhãn trạng thái của lá đơn: chấm màu + chữ trên nền nhạt.
 * @param status  mã trạng thái, vd 'xet'
 * @param query   chữ trong ô tìm kiếm của bảng, để tô sáng phần khớp (không bắt buộc)
 * @returns       thẻ <span> có màu theo trạng thái và chữ, vd "Đang xét"
 */
export function StatusPill({ status, query = '' }: { status: FormStatus; query?: string }) {
  return (
    <span className={`${styles.pill} ${styles[status]}`}>
      <Highlight text={FORM_STATUS_LABEL[status]} query={query} />
    </span>
  );
}

/* Màu nhãn trạng thái loại đơn mượn màu trạng thái lá đơn:
   Nháp như Đã nộp (xanh lơ), Đang mở như Đã duyệt (xanh lá), Đã đóng như Từ chối (đỏ). */
const FORM_TYPE_STATUS_COLOR: Record<FormTypeStatus, FormStatus> = { draft: 'nop', open: 'duyet', closed: 'tc' };

/**
 * Nhãn trạng thái của loại đơn, cùng kiểu với nhãn trạng thái lá đơn.
 * @param status  mã trạng thái loại đơn, vd 'open'
 * @param query   chữ trong ô tìm kiếm của bảng, để tô sáng phần khớp (không bắt buộc)
 * @returns       thẻ <span>, vd "Đang mở" màu xanh lá
 */
export function FormTypeStatusPill({ status, query = '' }: { status: FormTypeStatus; query?: string }) {
  return (
    <span className={`${styles.pill} ${styles[FORM_TYPE_STATUS_COLOR[status]]}`}>
      <Highlight text={FORM_TYPE_STATUS_LABEL[status]} query={query} />
    </span>
  );
}

/* Màu nhãn tình trạng hạn cũng mượn màu trạng thái lá đơn:
   Còn hạn xanh dương, Sắp tới hạn vàng, Quá hạn và Xong trễ hạn đỏ, Tạm dừng tím, Xong đúng hạn xanh lá. */
const DEADLINE_STATE_COLOR: Record<DeadlineState, FormStatus> = { onTrack: 'xet', dueSoon: 'bs', overdue: 'tc', paused: 'bsg', doneOnTime: 'duyet', doneLate: 'tc' };

/**
 * Nhãn tình trạng hạn xử lí của lá đơn, cùng kiểu với nhãn trạng thái lá đơn.
 * @param state  tình trạng hạn, vd 'overdue'
 * @param query  chữ trong ô tìm kiếm của bảng, để tô sáng phần khớp (không bắt buộc)
 * @returns      thẻ <span>, vd "Quá hạn" màu đỏ
 */
export function DeadlinePill({ state, query = '' }: { state: DeadlineState; query?: string }) {
  return (
    <span className={`${styles.pill} ${styles[DEADLINE_STATE_COLOR[state]]}`}>
      <Highlight text={DEADLINE_STATE_LABEL[state]} query={query} />
    </span>
  );
}
