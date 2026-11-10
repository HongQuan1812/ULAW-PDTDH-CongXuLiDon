/* Ô nhập có nhãn, ghi chú và câu báo lỗi (như label.f + .ferr của artifact/styles.css). */
import type { ReactNode } from 'react';
import styles from './Field.module.css';

interface FieldProps {
  /** Tên ô, vd "Họ và tên" */
  label: string;
  /** Ô bắt buộc: hiện dấu * màu đỏ cạnh tên ô */
  required?: boolean;
  /** Hiện "(không bắt buộc)" cạnh tên ô */
  optional?: boolean;
  /** Dòng ghi chú nhỏ dưới ô nhập */
  hint?: string;
  /** Câu báo lỗi; có thì hiện màu đỏ dưới ô và ô nhập viền đỏ (ô nhập cần aria-invalid) */
  error?: string;
  /** Ô nhập (thẻ <input>…) */
  children: ReactNode;
}

/**
 * Bọc một ô nhập: nhãn ở trên, ô nhập, ghi chú, rồi câu báo lỗi. Bấm vào nhãn thì con trỏ vào ô nhập.
 * @returns  thẻ <label> chứa toàn bộ
 */
export function Field({ label, required = false, optional = false, hint, error, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}*
          </span>
        )}
        {optional && <span className={styles.optional}> (không bắt buộc)</span>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
