/* So khớp chữ khi tìm kiếm: không phân biệt hoa thường, có dấu hay không dấu (gõ "da nop" vẫn ra "Đã nộp").
   normalizeText dùng chung với máy chủ (máy chủ tìm, trình duyệt tô sáng) nên nằm ở @ulaw/shared. */
import { normalizeText } from '@ulaw/shared';

export { normalizeText } from '@ulaw/shared';

/** Một đoạn chữ khớp với từ khóa: phần trước, phần khớp, phần sau. */
export interface TextMatch {
  before: string;
  match: string;
  after: string;
}

/**
 * Tìm chỗ đầu tiên trong chữ khớp với từ khóa, để tô sáng.
 * @param text   chữ gốc, vd "Đã nộp"
 * @param query  từ khóa người dùng gõ, vd "nop"
 * @returns      ba phần trước / khớp / sau; từ khóa trống hoặc không khớp thì null
 */
export function findMatch(text: string, query: string): TextMatch | null {
  const keyword = normalizeText(query.trim());
  if (!keyword) return null;

  // Tìm trên chữ đã chuẩn hóa, cắt trên chữ gốc (cùng số ký tự)
  const original = text.normalize('NFC');
  const start = normalizeText(original).indexOf(keyword);
  if (start < 0) return null;

  const end = start + keyword.length;
  return { before: original.slice(0, start), match: original.slice(start, end), after: original.slice(end) };
}
