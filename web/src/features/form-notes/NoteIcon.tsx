/* Hình bong bóng ghi chú, dùng cho nút tròn ở trang chi tiết đơn và ô Ghi chú của bảng đơn. */

/**
 * Hình bong bóng có hai dòng chữ.
 * @param size  cạnh hình (px), mặc định 24
 * @returns     thẻ <svg> (trình đọc màn hình bỏ qua), màu theo chữ của thẻ cha
 */
export function NoteIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16H6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 8h8M8 11.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
