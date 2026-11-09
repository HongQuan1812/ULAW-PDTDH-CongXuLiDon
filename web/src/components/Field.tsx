/* Ô nhập có nhãn, ghi chú và câu báo lỗi (như label.f + .ferr của artifact/styles.css). */
import type { ReactNode } from 'react';
import styles from './Field.module.css';

interface FieldProps {
  /** Tên ô, vd "Họ và tên" */
  label: string;
  /** Hiện "(không bắt buộc)" cạnh tên ô */
  optional?: boolean;
  /** Dòng ghi chú nhỏ dưới tên ô */
  hint?: string;
  /** Câu báo lỗi; có thì hiện màu đỏ dưới ô và ô nhập viền đỏ (ô nhập cần aria-invalid) */
  error?: string;
  /** Ô nhập (thẻ <input>…) */
  children: ReactNode;
}

/**
 * Bọc một ô nhập: nhãn ở trên, ghi chú, ô nhập, rồi câu báo lỗi. Bấm vào nhãn thì con trỏ vào ô nhập.
 * @returns  thẻ <label> chứa toàn bộ
 */
export function Field({ label, optional = false, hint, error, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span>
        {label}
        {optional && <span className={styles.optional}> (không bắt buộc)</span>}
      </span>
      {hint && <small>{hint}</small>}
      {children}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
