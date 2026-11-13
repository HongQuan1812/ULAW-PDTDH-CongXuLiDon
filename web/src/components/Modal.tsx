/* Hộp thoại giữa màn hình, có nền mờ phía sau. */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

/**
 * Hộp thoại. Chỉ vẽ khi đang mở. Bấm nền mờ hoặc Esc thì đóng.
 * Mở ra thì đưa con trỏ bàn phím vào ô nhập đầu tiên (không có thì nút đầu tiên); đóng thì trả về chỗ cũ.
 * @param open      đang mở hay không
 * @param onClose   gọi khi người dùng muốn đóng
 * @param title            tiêu đề hộp thoại
 * @param showCloseButton  true thì có nút × cạnh tiêu đề (cho hộp thoại không có nút Hủy / Đóng ở dưới)
 * @param className        class thêm cho khung hộp thoại, vd để rộng hơn
 * @param children         nội dung hộp thoại
 * @returns         hộp thoại, hoặc không gì cả khi đang đóng
 */
export function Modal({
  open,
  onClose,
  title,
  showCloseButton = false,
  className = '',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  showCloseButton?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Chỉ đóng khi cả lúc nhấn chuột và lúc thả chuột đều ở nền mờ (kéo chọn chữ trong ô nhập ra ngoài thì không đóng)
  const pressedOnBackdropRef = useRef(false);

  // Mở: nhớ chỗ con trỏ bàn phím đang đứng, đưa con trỏ vào hộp thoại; đóng: trả con trỏ về chỗ cũ
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const firstTarget =
      dialogRef.current?.querySelector<HTMLElement>('input:not([readonly]),select,textarea') ??
      dialogRef.current?.querySelector<HTMLElement>('button');
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

  if (!open) return null;

  // Vẽ thẳng vào <body>: đặt trong thanh có backdrop-filter / transform thì khung `fixed` bị cắt theo thanh đó
  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => (pressedOnBackdropRef.current = event.target === event.currentTarget)}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedOnBackdropRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`${styles.modal} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {showCloseButton ? (
          <div className={styles.head}>
            <h2 id={titleId}>{title}</h2>
            <button type="button" className={styles.closeButton} aria-label="Đóng" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ) : (
          <h2 id={titleId}>{title}</h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
