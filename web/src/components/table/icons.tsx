/* Biểu tượng của bộ công cụ bảng. */

/** Kính lúp trong ô tìm kiếm. */
export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** Hai mũi tên ngược chiều trên nút Sắp xếp. */
export function SortIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
    </svg>
  );
}

/**
 * Cái phễu trên nút Lọc và trên tiêu đề cột đang lọc.
 * @param size  cỡ biểu tượng (px), mặc định 16
 */
export function FilterIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}

/**
 * Mũi tên trên tiêu đề cột đang sắp xếp.
 * @param direction  'up' tăng dần · 'down' giảm dần
 */
export function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'up' ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'} />
    </svg>
  );
}
