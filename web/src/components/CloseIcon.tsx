/* Dấu × của các nút Đóng / Tắt / Bỏ (hộp thoại, khung bên, toast, xem tệp, menu trượt…). */

/**
 * Biểu tượng ×.
 * @param size         cỡ (px), mặc định 20
 * @param strokeWidth  độ dày nét, mặc định 2
 * @returns            thẻ <svg> trình đọc màn hình bỏ qua (nút chứa nó tự có aria-label)
 */
export function CloseIcon({ size = 20, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
