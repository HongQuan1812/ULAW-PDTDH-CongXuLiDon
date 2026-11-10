/* Câu báo trong trình xem tệp: đang mở, không mở được, chưa xem trước được. */
import type { ReactNode } from 'react';
import styles from './FilePreview.module.css';

/**
 * @param title     dòng đậm (có thể bỏ trống nếu chỉ có một câu ngắn)
 * @param children  câu giải thích hoặc nút kèm theo
 * @returns         khối chữ căn giữa
 */
export function PreviewMessage({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className={styles.message} role="status">
      {title && <strong>{title}</strong>}
      {children && <span>{children}</span>}
    </div>
  );
}
