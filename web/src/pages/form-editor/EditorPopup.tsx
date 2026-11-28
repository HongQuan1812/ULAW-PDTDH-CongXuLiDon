/* Khung nổi của trình soạn loại đơn, mở từ một nút tròn ở cạnh phải (EditorDock.tsx): đầu khung (tên, lời giới thiệu, nút đóng)
   và phần cuộn được bên dưới. Khung Cấu hình thời gian và khung Mẫu xuất file cùng dùng. Bấm Esc thì đóng khung, như các hộp thoại khác;
   đang mở hộp thoại con (xem tệp…) thì Esc chỉ đóng hộp thoại đó. */
import { useId, type ReactNode } from 'react';
import { CloseIcon } from '../../components/CloseIcon';
import { useCloseOnEscape } from '../../lib/useCloseOnEscape';
import styles from './EditorDock.module.css';

interface EditorPopupProps {
  /** Tên khung, vd "Cấu hình thời gian" */
  title: string;
  /** Lời giới thiệu dưới tên */
  intro: string;
  /** Bấm nút đóng hoặc Esc */
  onClose: () => void;
  /** Nội dung, nằm trong phần cuộn được */
  children: ReactNode;
}

/**
 * Khung nổi có đầu khung và phần cuộn được.
 * @param props  xem EditorPopupProps
 * @returns      thẻ <section role="dialog">
 */
export function EditorPopup({ title, intro, onClose, children }: EditorPopupProps) {
  const titleId = useId();
  useCloseOnEscape(true, onClose);

  return (
    <section className={styles.popup} role="dialog" aria-labelledby={titleId}>
      {/* Đầu khung: tên, lời giới thiệu, nút đóng */}
      <header className={styles.popupHead}>
        <div>
          <h2 id={titleId}>{title}</h2>
          <p className={styles.intro}>{intro}</p>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label={`Đóng ${title}`} title="Đóng">
          <CloseIcon size={18} />
        </button>
      </header>

      {/* Phần cuộn được */}
      <div className={styles.popupBody}>{children}</div>
    </section>
  );
}
