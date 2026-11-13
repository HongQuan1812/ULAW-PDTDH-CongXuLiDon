/* Nút tròn nổi ở góc phải dưới (Ghi chú nội bộ, Mẫu xuất file) tự nâng lên đứng trên các thanh dính đáy màn hình, không che nút trên thanh. */
import { useEffect, useState, type RefObject } from 'react';

/** Thuộc tính đánh dấu thanh nằm ở đáy màn hình mà nút tròn không được che (vd hàng nút Duyệt / Lưu thay đổi dính đáy). */
export const AVOID_FLOATING_BUTTON_ATTRIBUTE = 'data-avoid-floating-button';

/** Khoảng cách giữa nút tròn và thanh nằm dưới nó (px). */
const FAB_GAP = 12;

/**
 * Chỗ đứng của nút tròn nổi tính từ đáy màn hình. Bình thường ở góc phải dưới; thanh có AVOID_FLOATING_BUTTON_ATTRIBUTE
 * mà nằm đúng chỗ đó (vd màn hình hẹp, thanh kéo dài tới mép phải) thì nút nâng lên đứng trên thanh.
 * Tính lại khi cuộn, đổi cỡ màn hình, hoặc trang đổi (thanh hiện / ẩn, khung Thông tin đơn mở / đóng).
 * @param buttonRef    nút tròn (hoặc nhóm nút tròn) nổi ở góc phải dưới
 * @param baseBottoms  khoảng cách mặc định tới đáy màn hình (px): màn hình rộng, màn hình hẹp
 * @returns          khoảng cách tới đáy màn hình (px); chưa tính xong thì null (dùng chỗ mặc định của CSS)
 */
export function useFloatingButtonBottom(buttonRef: RefObject<HTMLElement | null>, baseBottoms: { wide: number; narrow: number }): number | null {
  const [fabBottom, setFabBottom] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;

    /** Tính lại chỗ đứng, gộp nhiều lần gọi trong cùng một khung hình. */
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const button = buttonRef.current;
        if (!button) return;

        // Chỗ mặc định ở góc phải dưới (màn hình hẹp sát góc hơn, như CSS)
        const baseBottom = window.matchMedia('(max-width:560px)').matches ? baseBottoms.narrow : baseBottoms.wide;
        const { left, right } = button.getBoundingClientRect();
        const defaultTop = window.innerHeight - baseBottom - button.offsetHeight;

        // Thanh nào chồng lên chỗ mặc định thì đứng trên thanh đó
        let nextBottom = baseBottom;
        document.querySelectorAll<HTMLElement>(`[${AVOID_FLOATING_BUTTON_ATTRIBUTE}]`).forEach((bar) => {
          const rect = bar.getBoundingClientRect();
          const overlapsAcross = rect.left < right + FAB_GAP && rect.right > left - FAB_GAP;
          const overlapsDown = rect.top < window.innerHeight - baseBottom && rect.bottom > defaultTop - FAB_GAP;
          if (overlapsAcross && overlapsDown) nextBottom = Math.max(nextBottom, window.innerHeight - rect.top + FAB_GAP);
        });
        setFabBottom(nextBottom);
      });
    };

    // Tính ngay, rồi theo dõi cuộn, đổi cỡ, trang đổi
    update();
    window.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    const pageObserver = new MutationObserver(update);
    pageObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
      pageObserver.disconnect();
    };
  }, [buttonRef, baseBottoms.wide, baseBottoms.narrow]);

  return fabBottom;
}
