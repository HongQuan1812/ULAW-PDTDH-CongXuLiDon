/* Hộp thoại giữa màn hình, có nền mờ phía sau (như .modal-bg, .modal của bản mẫu). */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Modal.module.css';

/**
 * Hộp thoại. Chỉ vẽ khi đang mở. Bấm nền mờ hoặc Esc thì đóng.
 * Mở ra thì đưa con trỏ bàn phím vào ô nhập đầu tiên (không có thì nút đầu tiên); đóng thì trả về chỗ cũ.
 * @param open      đang mở hay không
 * @param onClose   gọi khi người dùng muốn đóng
 * @param title     tiêu đề hộp thoại
 * @param children  nội dung hộp thoại
 * @returns         hộp thoại, hoặc không gì cả khi đang đóng
 */
export function Modal({
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

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => (pressedOnBackdropRef.current = event.target === event.currentTarget)}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedOnBackdropRef.current) onClose();
      }}
    >
      <div ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
