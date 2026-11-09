import { useSyncExternalStore } from 'react';

/**
 * Theo dõi một điều kiện CSS media query, vd màn hình hẹp.
 * @param query  điều kiện, vd '(max-width: 960px)'
 * @returns      true khi điều kiện đang đúng; tự cập nhật khi đổi cỡ cửa sổ
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    // Đăng ký nghe thay đổi
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    // Đọc giá trị hiện tại
    () => window.matchMedia(query).matches,
  );
}
