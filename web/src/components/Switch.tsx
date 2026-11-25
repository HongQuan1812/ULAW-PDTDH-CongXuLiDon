/* Nút gạt bật / tắt dùng chung (Bắt buộc trả lời, Nội dung chính, Gửi email, bật lịch sao lưu…). */
import type { ReactNode } from 'react';
import styles from './Switch.module.css';

/**
 * Nút gạt có chữ đi kèm; bấm vào chữ cũng gạt được.
 * @param checked      đang bật
 * @param onChange     gọi với trạng thái mới khi gạt
 * @param label        chữ đi kèm
 * @param labelBefore  true: chữ đứng trước nút gạt (mặc định đứng sau)
 * @param className    class thêm theo chỗ đặt (vd khoảng cách)
 * @returns            <label> chứa ô chọn vẽ thành công tắc
 */
export function Switch({
  checked,
  onChange,
  label,
  labelBefore = false,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  labelBefore?: boolean;
  className?: string;
}) {
  const labelText = <span>{label}</span>;
  return (
    <label className={`${styles.switch} ${className ?? ''}`}>
      {labelBefore && labelText}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {!labelBefore && labelText}
    </label>
  );
}
