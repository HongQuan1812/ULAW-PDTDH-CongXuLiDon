/* MÃ CHÈN VÀO EMAIL báo cho người nộp đơn.
   Admin gõ mã trong ngoặc nhọn vào tiêu đề và nội dung thư, vd {ho_ten}; lúc gửi, máy chủ thay mã bằng dữ liệu của đơn.
   Trang Cấu hình email (xem trước), API giả và backend (gửi thư thật, gửi thư thử) cùng dùng file này. */

/** Các mã dùng được, theo thứ tự hiện trên trang. */
export const EMAIL_TAGS = ['ho_ten', 'ma_don', 'loai_don', 'ngay_nop', 'nguoi_xu_li', 'ly_do', 'link_don', 'chu_ki'] as const;
export type EmailTag = (typeof EMAIL_TAGS)[number];

/** Ý nghĩa của từng mã, hiện khi rê chuột lên nút chèn mã. */
export const EMAIL_TAG_LABEL: Record<EmailTag, string> = {
  ho_ten: 'Họ và tên người nộp',
  ma_don: 'Mã đơn',
  loai_don: 'Tên loại đơn',
  ngay_nop: 'Ngày nộp',
  nguoi_xu_li: 'Người xử lí đơn',
  ly_do: 'Lí do (ghi chú của người xử lí)',
  link_don: 'Đường dẫn tới đơn',
  chu_ki: 'Chữ kí cuối thư',
};

/** Giá trị thay cho từng mã của một bức thư. */
export type EmailTagValues = Record<EmailTag, string>;

/** Dữ liệu mẫu cho khung xem trước và thư gửi thử (không phải người thật). Chữ kí lấy theo cấu hình người gửi. */
export const EMAIL_SAMPLE_VALUES: Omit<EmailTagValues, 'chu_ki'> = {
  ho_ten: 'Nguyễn Văn An',
  ma_don: 'XMM-2026-001-00001',
  loai_don: 'Xét miễn môn',
  ngay_nop: '30/10/2026',
  nguoi_xu_li: 'Phạm Thu Hà',
  ly_do: 'Thiếu bảng điểm bản chính, vui lòng tải lại tệp rõ hơn.',
  link_don: 'https://dichvu.hcmulaw.edu.vn/#/don/XMM-2026-001-00001',
};

/** Email người nộp đơn mẫu, hiện ở dòng "Tới" của khung xem trước. */
export const EMAIL_SAMPLE_RECIPIENT = 'vanan.nguyen@hcmulaw.edu.vn';

/** Chữ thêm vào đầu tiêu đề thư gửi thử. */
export const TEST_EMAIL_SUBJECT_PREFIX = '[Thử] ';

/** Một đoạn của tiêu đề / nội dung thư sau khi tách mã. */
export type EmailTextPart =
  /** chữ thường, giữ nguyên */
  | { kind: 'text'; text: string }
  /** mã đã thay bằng giá trị */
  | { kind: 'filled'; tag: EmailTag; text: string }
  /** mã không có trong EMAIL_TAGS, giữ nguyên cả ngoặc nhọn */
  | { kind: 'unknown'; text: string };

/** Một mã trong thư: chữ thường không dấu và gạch dưới trong ngoặc nhọn. */
const EMAIL_TAG_IN_TEXT = /\{([a-z_]+)\}/g;

/**
 * Kiểm tra một chữ có phải mã dùng được không.
 * @param tag  chữ trong ngoặc nhọn, vd 'ho_ten'
 * @returns    true nếu có trong EMAIL_TAGS
 */
export function isEmailTag(tag: string): tag is EmailTag {
  return (EMAIL_TAGS as readonly string[]).includes(tag);
}

/**
 * Tách tiêu đề / nội dung thư thành các đoạn, thay mã bằng giá trị (để xem trước: tô nền phần đã thay, tô đỏ mã lạ).
 * @param template  tiêu đề hoặc nội dung có mã, vd 'Chào {ho_ten},'
 * @param values    giá trị của từng mã
 * @returns         các đoạn theo thứ tự; nối text của chúng lại là thư sau khi thay
 */
export function splitEmailTemplate(template: string, values: EmailTagValues): EmailTextPart[] {
  const parts: EmailTextPart[] = [];
  let textStart = 0;

  // Mỗi mã: đẩy phần chữ trước nó, rồi đẩy mã (đã thay hoặc mã lạ)
  for (const match of template.matchAll(EMAIL_TAG_IN_TEXT)) {
    if (match.index > textStart) parts.push({ kind: 'text', text: template.slice(textStart, match.index) });
    const tag = match[1]!;
    parts.push(isEmailTag(tag) ? { kind: 'filled', tag, text: values[tag] } : { kind: 'unknown', text: match[0] });
    textStart = match.index + match[0].length;
  }

  // Phần chữ sau mã cuối cùng
  if (textStart < template.length) parts.push({ kind: 'text', text: template.slice(textStart) });
  return parts;
}

/**
 * Thay mã trong tiêu đề / nội dung thư bằng giá trị; mã lạ giữ nguyên.
 * @param template  tiêu đề hoặc nội dung có mã
 * @param values    giá trị của từng mã
 * @returns         chữ sau khi thay, vd 'Chào Nguyễn Văn An,'
 */
export function fillEmailTemplate(template: string, values: EmailTagValues): string {
  return splitEmailTemplate(template, values)
    .map((part) => part.text)
    .join('');
}
