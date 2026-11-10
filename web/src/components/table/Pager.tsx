/* Thanh phân trang dưới bảng, như renderPager() của bản mẫu. */
import { useLayoutEffect, useRef } from 'react';
import styles from './table.module.css';

interface PagerProps {
  /** Trang đang xem, đếm từ 0 */
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  /** Số dòng sau khi tìm, lọc (tất cả các trang) */
  total: number;
  /** Tên đơn vị đếm, vd "đơn" */
  unit: string;
  onPageChange: (pageIndex: number) => void;
}

/**
 * Thanh phân trang. Vừa một trang thì chỉ ghi tổng số; nhiều trang thì ghi "Hiển thị 1–8 trong 18 đơn" và các nút trang.
 * Khi chuyển trang, thanh đứng yên trên màn hình (bảng ngắn lại ở trang cuối cũng không làm trang nhảy)
 * và con trỏ ở lại nút vừa bấm, hoặc sang nút trang hiện tại nếu nút vừa bấm bị khóa (vd "Trang sau" ở trang cuối).
 * @param props  xem PagerProps
 * @returns      thanh phân trang; không có dòng nào thì không hiện gì
 */
export function Pager({ pageIndex, pageCount, pageSize, total, unit, onPageChange }: PagerProps) {
  const pagerRef = useRef<HTMLDivElement>(null);
  const topBeforeChange = useRef<number | null>(null);

  // Sau khi đổi trang: cuộn bù cho thanh đứng yên, giữ con trỏ trên một nút còn bấm được
  useLayoutEffect(() => {
    const pager = pagerRef.current;
    if (!pager || topBeforeChange.current === null) return;
    window.scrollBy(0, pager.getBoundingClientRect().top - topBeforeChange.current);
    topBeforeChange.current = null;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLButtonElement) || focused.disabled || !pager.contains(focused)) {
      pager.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus({ preventScroll: true });
    }
  }, [pageIndex]);

  // Ghi lại vị trí thanh trước khi đổi trang
  const goTo = (nextIndex: number) => {
    topBeforeChange.current = pagerRef.current?.getBoundingClientRect().top ?? null;
    onPageChange(nextIndex);
  };

  if (!total) return null;
  if (total <= pageSize) {
    return (
      <div className={styles.pager}>
        <span>
          {total} {unit}
        </span>
      </div>
    );
  }

  const from = pageIndex * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  return (
    <div className={styles.pager} ref={pagerRef}>
      <span>
        Hiển thị {from}–{to} trong {total} {unit}
      </span>
      <nav className={styles.pages} aria-label="Phân trang">
        <button
          type="button"
          className={styles.pageButton}
          aria-label="Trang trước"
          disabled={pageIndex === 0}
          onClick={() => goTo(pageIndex - 1)}
        >
          ‹
        </button>
        {Array.from({ length: pageCount }, (_, index) => (
          <button
            key={index}
            type="button"
            className={styles.pageButton}
            aria-current={index === pageIndex ? 'page' : undefined}
            onClick={() => goTo(index)}
          >
            {index + 1}
          </button>
        ))}
        <button
          type="button"
          className={styles.pageButton}
          aria-label="Trang sau"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => goTo(pageIndex + 1)}
        >
          ›
        </button>
      </nav>
    </div>
  );
}
