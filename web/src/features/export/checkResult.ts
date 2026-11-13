/* Câu kết quả "Kiểm tra mã" của một mẫu xuất file: dùng ở khung Mẫu xuất file (trình soạn loại đơn, so với câu hỏi của loại đơn)
   và hộp "Chọn mẫu" của nút Xuất file (chi tiết đơn, so với câu hỏi của lá đơn). */
import { EXPORT_MESSAGES, type ExportTemplateCheck } from '@ulaw/shared';

/** Kết quả kiểm tra mã một mẫu. */
export interface TemplateResult {
  tone: 'good' | 'bad';
  text: string;
}

/**
 * Câu kết quả của Kiểm tra mã.
 * @param check      kết quả từ máy chủ
 * @param tableTags  mã các câu hỏi dạng bảng, để chỉ chỗ đặt mã cột
 * @param subject    mã được so với cái gì, vd "loại đơn", "đơn"
 * @returns          câu báo và sắc thái (tốt / có vấn đề)
 */
export function checkResultOf(check: ExportTemplateCheck, tableTags: string[], subject: string): TemplateResult {
  const codes = (tags: string[]) => tags.map((tag) => `{${tag}}`).join(' ');
  if (check.error) return { tone: 'bad', text: `Mẫu có lỗi: ${check.error}` };
  if (!check.found.length) return { tone: 'bad', text: 'Không thấy mã trường nào trong mẫu. Gõ mã trong ngoặc nhọn, vd {ho_ten}.' };
  const problems: string[] = [];
  if (check.unknown.length) {
    problems.push(`Có ${check.unknown.length} mã không có trong ${subject} này: ${codes(check.unknown)} — sẽ để trống khi xuất file.`);
  }
  if (check.outside.length) {
    const loops = tableTags.map((tag) => `{#${tag}} … {/${tag}}`).join(' hoặc ');
    problems.push(`Mã cột ${codes(check.outside)} nằm ngoài vòng lặp — sẽ để trống. Đặt chúng giữa ${loops}.`);
  }
  if (problems.length) return { tone: 'bad', text: problems.join('\n') };
  return { tone: 'good', text: `Mẫu khớp với ${subject} này: ${check.found.length} mã trường đều dùng được.` };
}

/**
 * Kết quả khi chính việc kiểm tra gặp lỗi (mạng, mẫu không còn…).
 * @param error  lỗi bắt được
 * @returns      câu báo
 */
export function checkFailureOf(error: unknown): TemplateResult {
  return { tone: 'bad', text: error instanceof Error ? error.message : EXPORT_MESSAGES.unreadable };
}
