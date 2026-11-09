/* Trang tạm cho các trang chưa làm. Xóa khi mọi trang đã xong. */
import styles from './ComingSoon.module.css';

/**
 * Khung trang tạm: tiêu đề trang và dòng báo sẽ làm ở bước nào.
 * @param title  tên trang, vd "Quản lí đơn"
 * @param step   số bước trong plan.md sẽ làm trang này
 * @returns      giao diện trang tạm
 */
export function ComingSoon({ title, step }: { title: string; step: number }) {
  return (
    <div className={styles.page}>
      <h1>{title}</h1>
      <section className={styles.card}>
        <p>Trang này sẽ làm ở bước {step}.</p>
      </section>
    </div>
  );
}
