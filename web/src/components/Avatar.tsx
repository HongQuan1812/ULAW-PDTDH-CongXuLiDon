import styles from './Avatar.module.css';

/**
 * Chữ cái đại diện: chữ đầu của tên (từ cuối trong họ tên), vd "Nguyễn Minh Anh" → "A".
 * @param name  họ và tên
 * @returns     một chữ in hoa; tên trống thì "?"
 */
function initialOf(name: string): string {
  const words = name.trim().split(/\s+/);
  return (words[words.length - 1]?.[0] ?? '?').toUpperCase();
}

/**
 * Hình tròn có chữ cái đại diện của người dùng.
 * @param name  họ và tên
 * @param size  cỡ: 'sm' (thanh trên), 'md' (mặc định), 'xl' (trang thông tin)
 * @returns     thẻ <span> hình tròn (trình đọc màn hình bỏ qua)
 */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'xl' }) {
  return (
    <span className={`${styles.avatar} ${styles[size]}`} aria-hidden="true">
      {initialOf(name)}
    </span>
  );
}
