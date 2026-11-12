/* Nút bấm dùng chung. */
import type { ComponentProps } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';

/** Mọi thuộc tính của thẻ <button> (kể cả ref) và kiểu nút. */
interface ButtonProps extends ComponentProps<'button'> {
  /** Kiểu nút: 'default' viền mảnh · 'primary' nền xanh (việc chính) · 'ghost' không viền (việc phụ) · 'danger' chữ đỏ (việc xóa) */
  variant?: ButtonVariant;
}

/**
 * Nút bấm bo tròn.
 * @param variant  kiểu nút, mặc định 'default'
 * @param type     mặc định 'button' để không vô tình gửi form; nút gửi form truyền type="submit"
 * @returns        thẻ <button>
 */
export function Button({ variant = 'default', type = 'button', className, ...rest }: ButtonProps) {
  const classes = [styles.btn, variant === 'default' ? '' : styles[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
