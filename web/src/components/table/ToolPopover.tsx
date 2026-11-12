/* Nút công cụ của bảng (Sắp xếp, Lọc) kèm bảng nổi bên dưới.
   Bấm ra ngoài hoặc Esc thì đóng. */
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './table.module.css';

interface ToolPopoverProps {
  /** Chữ trên nút, vd "Sắp xếp"; cũng là tên của bảng nổi cho trình đọc màn hình */
  label: string;
  icon: ReactNode;
  /** Số đang áp dụng (số dòng sắp xếp, số điều kiện lọc); 0 thì không hiện số và nút không tô màu */
  count: number;
  open: boolean;
  /** Bấm nút: mở nếu đang đóng, đóng nếu đang mở */
  onToggle: () => void;
  /** Bấm ra ngoài hoặc Esc */
  onClose: () => void;
  /** Nội dung bảng nổi */
  children: ReactNode;
}

/**
 * Nút công cụ và bảng nổi của nó.
 * @param props  xem ToolPopoverProps
 * @returns      nút và (khi mở) bảng nổi
 */
export function ToolPopover({ label, icon, count, open, onToggle, onClose, children }: ToolPopoverProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Đang mở: nhấn chuột ra ngoài thì đóng; Esc thì đóng và trả con trỏ về nút
  // (nghe lúc nhấn chuột xuống, khi phần tử được bấm còn nằm trong trang, chưa bị vẽ lại)
  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onClose();
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);

  return (
    <div className={styles.popWrap} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.toolButton} ${count ? styles.toolButtonOn : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggle}
      >
        {icon}
        {label}
        {count > 0 && <span className={styles.count}>{count}</span>}
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}
