/* Thanh phân trang dưới bảng, như renderPager() của bản mẫu. */
import { useLayoutEffect, useRef } from 'react';
import styles from './table.module.css';

/** Nhiều trang hơn số này thì thu gọn bằng "…" (thanh luôn có đúng chừng ấy ô). */
const MAX_PAGE_ITEMS = 7;

/** Một ô của thanh trang: số thứ tự trang (đếm từ 0), hoặc dấu "…" trước / sau các trang quanh trang đang xem. */
type PagerItem = number | 'gapBefore' | 'gapAfter';

/**
 * Các ô trang cần hiện. Ít trang thì hiện đủ; nhiều trang thì luôn có trang đầu, trang cuối và các trang quanh trang đang xem,
 * chỗ bị bỏ ghi "…", vd 100 trang: đang ở trang 1 → 1 2 3 4 5 … 100 · trang 50 → 1 … 49 50 51 … 100 · trang 99 → 1 … 96 97 98 99 100.
 * @param pageIndex  trang đang xem, đếm từ 0
 * @param pageCount  số trang
 * @returns          các ô theo thứ tự trái sang phải
 */
export function pagerItems(pageIndex: number, pageCount: number): PagerItem[] {
  const pageRange = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, offset) => from + offset);
  const lastIndex = pageCount - 1;

  // Ít trang: hiện đủ
  if (pageCount <= MAX_PAGE_ITEMS) return pageRange(0, lastIndex);

  // Gần đầu hoặc gần cuối: chỉ một dấu "…"; ở giữa: hai dấu "…" kẹp trang đang xem và hai trang bên cạnh
  if (pageIndex <= 3) return [...pageRange(0, 4), 'gapAfter', lastIndex];
  if (pageIndex >= lastIndex - 3) return [0, 'gapBefore', ...pageRange(lastIndex - 4, lastIndex)];
  return [0, 'gapBefore', pageIndex - 1, pageIndex, pageIndex + 1, 'gapAfter', lastIndex];
}

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
  /** Đang tải trang vừa bấm (bảng phân trang ở máy chủ): ghi "Đang tải…", khóa các nút */
  loading?: boolean;
}

/**
 * Thanh phân trang. Vừa một trang thì chỉ ghi tổng số; nhiều trang thì ghi "Hiển thị 1–8 trong 18 đơn" và các nút trang.
 * Khi chuyển trang, thanh đứng yên trên màn hình (bảng ngắn lại ở trang cuối cũng không làm trang nhảy)
 * và con trỏ ở lại nút vừa bấm, hoặc sang nút trang hiện tại nếu nút vừa bấm bị khóa (vd "Trang sau" ở trang cuối).
 * Đang tải trang vừa bấm thì nút trang đó đã được tô, chữ bên trái ghi "Đang tải…", các nút bị khóa đến khi tải xong.
 * @param props  xem PagerProps
 * @returns      thanh phân trang; không có dòng nào thì không hiện gì
 */
export function Pager({ pageIndex, pageCount, pageSize, total, unit, onPageChange, loading = false }: PagerProps) {
  const pagerRef = useRef<HTMLDivElement>(null);
  const topBeforeChange = useRef<number | null>(null);

  // Sau khi đổi trang: cuộn bù cho thanh đứng yên, giữ con trỏ trên một nút còn bấm được.
  // Đang tải thì bảng vẫn là trang cũ: bù một lần, giữ vị trí cũ để bù tiếp khi trang mới hiện ra
  useLayoutEffect(() => {
    const pager = pagerRef.current;
    if (!pager || topBeforeChange.current === null) return;
    window.scrollBy(0, pager.getBoundingClientRect().top - topBeforeChange.current);
    if (loading) return;
    topBeforeChange.current = null;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLButtonElement) || focused.disabled || !pager.contains(focused)) {
      pager.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus({ preventScroll: true });
    }
  }, [pageIndex, loading]);

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
      <span aria-live="polite">{loading ? 'Đang tải…' : `Hiển thị ${from}–${to} trong ${total} ${unit}`}</span>
      <nav className={styles.pages} aria-label="Phân trang">
        <button
          type="button"
          className={styles.pageButton}
          aria-label="Trang trước"
          disabled={loading || pageIndex === 0}
          onClick={() => goTo(pageIndex - 1)}
        >
          ‹
        </button>
        {pagerItems(pageIndex, pageCount).map((pageItem) =>
          pageItem === 'gapBefore' || pageItem === 'gapAfter' ? (
            <span key={pageItem} className={styles.pageGap} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={pageItem}
              type="button"
              className={styles.pageButton}
              aria-current={pageItem === pageIndex ? 'page' : undefined}
              disabled={loading}
              onClick={() => goTo(pageItem)}
            >
              {pageItem + 1}
            </button>
          ),
        )}
        <button
          type="button"
          className={styles.pageButton}
          aria-label="Trang sau"
          disabled={loading || pageIndex >= pageCount - 1}
          onClick={() => goTo(pageIndex + 1)}
        >
          ›
        </button>
      </nav>
    </div>
  );
}
