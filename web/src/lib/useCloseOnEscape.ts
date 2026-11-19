/* Bấm Esc để đóng popup (hộp thoại, ngăn kéo bên, xem tệp, khung nổi, menu, bảng lọc…), một cách cho mọi popup.
   Các popup đang mở xếp thành chồng: mỗi lần Esc chỉ đóng popup mở sau cùng
   (vd đang xem tệp mở từ hộp thoại: Esc đóng xem tệp, hộp thoại vẫn còn). */
import { useEffect, useRef } from 'react';

/** Các popup đang mở, mở sau cùng ở cuối; mỗi phần tử trỏ tới hàm đóng mới nhất của popup đó. */
const openPopups: { current: () => void }[] = [];

/**
 * Nghe phím Esc trên cả trang (gắn một lần): đóng popup mở sau cùng.
 * Ô bên trong đã tự xử lí Esc (vd hủy đổi tên, đóng danh sách gợi ý) thì chặn sự kiện lại, không tới đây.
 * @param event  sự kiện phím
 */
function closeTopPopup(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const topPopup = openPopups.at(-1);
  if (!topPopup) return;
  event.preventDefault();
  topPopup.current();
}

if (typeof document !== 'undefined') document.addEventListener('keydown', closeTopPopup);

/**
 * Popup đóng được bằng Esc, con trỏ bàn phím ở đâu trên trang cũng được.
 * @param open     popup đang mở
 * @param onClose  đóng popup
 */
export function useCloseOnEscape(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Mở: đưa popup lên đầu chồng; đóng: bỏ khỏi chồng
  useEffect(() => {
    if (!open) return;
    openPopups.push(closeRef);
    return () => {
      const index = openPopups.lastIndexOf(closeRef);
      if (index !== -1) openPopups.splice(index, 1);
    };
  }, [open]);
}
