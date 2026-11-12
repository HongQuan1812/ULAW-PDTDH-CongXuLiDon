import { describe, expect, it } from 'vitest';
import { pagerItems } from './Pager';

/**
 * Ghi các ô trang thành chuỗi dễ đọc, số trang đếm từ 1.
 * @param pageNumber  trang đang xem, đếm từ 1
 * @param pageCount   số trang
 * @returns           vd "1 2 3 4 5 … 100"
 */
const shown = (pageNumber: number, pageCount: number) =>
  pagerItems(pageNumber - 1, pageCount)
    .map((pageItem) => (typeof pageItem === 'number' ? String(pageItem + 1) : '…'))
    .join(' ');

describe('pagerItems', () => {
  it('7 trang trở xuống thì hiện đủ', () => {
    expect(shown(1, 1)).toBe('1');
    expect(shown(4, 7)).toBe('1 2 3 4 5 6 7');
  });

  it('nhiều trang: luôn có trang đầu, trang cuối, trang quanh trang đang xem, luôn 7 ô', () => {
    expect(shown(1, 100)).toBe('1 2 3 4 5 … 100');
    expect(shown(4, 100)).toBe('1 2 3 4 5 … 100');
    expect(shown(5, 100)).toBe('1 … 4 5 6 … 100');
    expect(shown(50, 100)).toBe('1 … 49 50 51 … 100');
    expect(shown(96, 100)).toBe('1 … 95 96 97 … 100');
    expect(shown(97, 100)).toBe('1 … 96 97 98 99 100');
    expect(shown(100, 100)).toBe('1 … 96 97 98 99 100');
    expect(shown(4, 8)).toBe('1 2 3 4 5 … 8');
    expect(shown(5, 8)).toBe('1 … 4 5 6 7 8');
  });
});
