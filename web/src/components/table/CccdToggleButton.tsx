/* Nút "Hiện CCCD / Ẩn CCCD" trên thanh công cụ của bảng, nằm sau nút Lọc (như #aReveal, #uReveal của bản mẫu).
   Cùng kiểu với nút Sắp xếp, Lọc; đang hiện thì tô màu như nút đang bật. */
import styles from './table.module.css';

/**
 * Nút bật / tắt hiện số CCCD đầy đủ trong bảng.
 * @param shown     đang hiện CCCD đầy đủ
 * @param loading   đang tải số CCCD (chỉ khi vừa bấm Hiện): khóa nút, ghi "Đang tải…"
 * @param onToggle  bấm nút
 * @returns         nút bấm
 */
export function CccdToggleButton({ shown, loading, onToggle }: { shown: boolean; loading: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.toolButton} ${shown ? styles.toolButtonOn : ''}`}
      aria-pressed={shown}
      disabled={loading}
      onClick={onToggle}
    >
      {loading ? 'Đang tải…' : shown ? 'Ẩn CCCD' : 'Hiện CCCD'}
    </button>
  );
}
