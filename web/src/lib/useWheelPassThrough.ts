/* Cuộn tiếp ra trang khi khung con đã cuộn tới đáy / đỉnh.
   Trình duyệt giữ cả một lượt lăn chuột cho khung đang cuộn (scroll latching): khung chạm đáy mà chuột chưa nhích thì
   lăn tiếp vẫn không cuộn trang, phải rê chuột một chút mới được. Hook này tự cuộn phần bên ngoài trong lúc đó. */
import { useEffect, type RefObject } from 'react';

/** Số điểm ảnh của một dòng khi chuột lăn theo dòng (deltaMode = 1). */
const LINE_HEIGHT_PX = 16;

/**
 * Phần tử có cuộn dọc được không (có thanh cuộn và nội dung dài hơn khung).
 * @param element  phần tử
 * @returns        true nếu cuộn dọc được
 */
function isScrollable(element: Element): boolean {
  const { overflowY } = getComputedStyle(element);
  return (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight;
}

/**
 * Phần tử còn cuộn được theo hướng lăn không.
 * @param element  phần tử cuộn được
 * @param deltaY   hướng lăn: dương là xuống
 * @returns        true nếu chưa chạm đáy (lăn xuống) / chưa chạm đỉnh (lăn lên)
 */
function canScrollFurther(element: Element, deltaY: number): boolean {
  if (deltaY > 0) return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  return element.scrollTop > 0;
}

/**
 * Phần cuộn bên ngoài khung: phần tử cuộn được gần nhất phía trên, không có thì cả trang.
 * @param container  khung
 * @returns          phần tử để cuộn tiếp
 */
function outerScroller(container: Element): Element {
  for (let element = container.parentElement; element; element = element.parentElement) {
    if (isScrollable(element)) return element;
  }
  return document.scrollingElement ?? document.documentElement;
}

/**
 * Lăn chuột trong khung mà mọi phần cuộn bên trong (tính từ chỗ con trỏ ra tới khung) đã chạm đáy / đỉnh
 * thì cuộn phần bên ngoài, không phải chờ người dùng rê chuột.
 * @param containerRef  khung (vd thẻ "Thông tin đơn" bên phải)
 * @param enabled       false: không làm gì (vd khung đang ẩn)
 */
export function useWheelPassThrough(containerRef: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;

    /** Một lần lăn chuột trong khung. */
    const onWheel = (event: WheelEvent) => {
      // Phóng to (Ctrl + lăn), lăn ngang: để trình duyệt tự xử lí
      if (event.ctrlKey || event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      // Còn phần nào bên trong cuộn được theo hướng này thì để trình duyệt cuộn phần đó
      for (let element = event.target instanceof Element ? event.target : null; element && container.contains(element); element = element.parentElement) {
        if (isScrollable(element) && canScrollFurther(element, event.deltaY)) return;
      }

      // Hết chỗ cuộn: tự cuộn phần bên ngoài
      const deltaPx = event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT_PX : event.deltaMode === 2 ? event.deltaY * window.innerHeight : event.deltaY;
      event.preventDefault();
      outerScroller(container).scrollBy({ top: deltaPx });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [containerRef, enabled]);
}
