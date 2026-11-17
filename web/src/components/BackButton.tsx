/* Nút "‹ Quay lại …" ở đầu trang, dùng chung cho mọi trang (chi tiết đơn, nộp đơn, trình soạn loại đơn, thông tin, Cấu hình…). */
import styles from './BackButton.module.css';

/**
 * Nút quay lại trang trước.
 * @param label    tên trang trước, vd 'Quản lí đơn' → "‹ Quay lại Quản lí đơn"
 * @param onClick  việc khi bấm (navigate(-1), về một trang cố định…)
 * @returns        nút
 */
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.back} onClick={onClick}>
      ‹ Quay lại {label}
    </button>
  );
}
