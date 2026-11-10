/* Khung trượt từ phải ra (như khung "Thông tin đơn" ở màn hình hẹp và khung "Thông tin sinh viên" của bản mẫu). */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Sheet.module.css';

/**
 * Khung trượt từ phải ra, có nền mờ phía sau. Bấm nền mờ, nút × hoặc Esc thì đóng.
 * Mở ra thì đưa con trỏ bàn phím vào khung; đóng lại thì trả về chỗ cũ (thường là nút đã mở khung).
 * @param open      đang mở hay không
 * @param onClose   gọi khi người dùng muốn đóng
 * @param title     tiêu đề trên đầu khung
 * @param children  nội dung khung
 * @returns         khung (luôn có trong trang để chạy hiệu ứng trượt; lúc đóng thì ẩn và không bấm được)
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  // Mở: nhớ chỗ con trỏ bàn phím đang đứng, đưa con trỏ vào khung; đóng: trả con trỏ về chỗ cũ
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const firstTarget =
      panelRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      panelRef.current?.querySelector<HTMLElement>('button');
    firstTarget?.focus({ preventScroll: true });
    return () => previousFocus?.focus({ preventScroll: true });
  }, [open]);

  // Đang mở: bấm Esc thì đóng
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <aside
        ref={panelRef}
        className={`${styles.sheet} ${open ? styles.open : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
      >
        <div className={styles.head}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={styles.close} aria-label="Đóng" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
