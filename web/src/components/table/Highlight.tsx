import { findMatch } from '../../lib/search';

/**
 * Chữ có tô sáng phần khớp với ô tìm kiếm (không phân biệt dấu).
 * @param text   chữ cần hiện
 * @param query  chữ trong ô tìm kiếm; trống thì hiện chữ thường
 * @returns      chữ, phần khớp bọc trong <mark>
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const found = findMatch(text, query);
  if (!found) return <>{text}</>;
  return (
    <>
      {found.before}
      <mark>{found.match}</mark>
      {found.after}
    </>
  );
}
