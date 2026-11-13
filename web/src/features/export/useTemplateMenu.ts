/* Danh sách "Chọn mẫu" xổ xuống dưới nút xuất file (nút Xuất file ở chi tiết đơn, nút Xuất thống kê ở trình soạn loại đơn):
   nhấn chuột ra ngoài thì đóng; Esc thì đóng và trả con trỏ về nút. */
import { useEffect, useRef, useState } from 'react';

/**
 * Trạng thái mở / đóng của danh sách chọn mẫu.
 * @returns  menuOpen, setMenuOpen: đang mở hay không · wrapRef: gắn vào khối bọc nút và danh sách · buttonRef: gắn vào nút
 */
export function useTemplateMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Danh sách đang mở: nhấn chuột ra ngoài thì đóng; Esc thì đóng và trả con trỏ về nút
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  return { menuOpen, setMenuOpen, wrapRef, buttonRef };
}
