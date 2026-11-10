import { FORM_STATUS_LABEL, type FormStatus } from '@ulaw/shared';
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
