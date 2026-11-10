/* So khớp chữ khi tìm kiếm: không phân biệt hoa thường, có dấu hay không dấu (gõ "da nop" vẫn ra "Đã nộp"). */

/**
 * Đưa chữ về dạng để so khớp: bỏ dấu tiếng Việt, đ → d, chữ thường.
 * Giữ nguyên số ký tự (với chữ đã dựng sẵn dạng NFC), nên vị trí tìm được dùng lại được trên chữ gốc.
 * @param text  chữ gốc, vd "Đã nộp"
 * @returns     chữ đã chuẩn hóa, vd "da nop"
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

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
