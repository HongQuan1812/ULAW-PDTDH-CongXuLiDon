import { FORM_STATUS_LABEL, type FormStatus } from '@ulaw/shared';
import styles from './StatusPill.module.css';

/**
 * Nhãn trạng thái của lá đơn: chấm màu + chữ trên nền nhạt.
 * @param status  mã trạng thái, vd 'xet'
 * @returns       thẻ <span> có màu theo trạng thái và chữ, vd "Đang xét"
 */
export function StatusPill({ status }: { status: FormStatus }) {
  return <span className={`${styles.pill} ${styles[status]}`}>{FORM_STATUS_LABEL[status]}</span>;
}
