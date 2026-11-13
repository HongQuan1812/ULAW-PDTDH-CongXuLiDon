/* Dựng một bức thư từ cấu hình email: thay mã {...} bằng dữ liệu, đổi nội dung (văn bản có định dạng, JSON của Tiptap) sang HTML.
   Kèm bản chữ thường cho trình đọc thư không hiện HTML. Mã chèn vào thư: shared/src/business-rules/email--tags.ts. */
import { fillEmailTemplate, richTextToPlainText, type EmailTagValues, type RichTextDoc, type RichTextNode } from '@ulaw/shared';

/** Thẻ HTML của từng định dạng chữ. */
const MARK_TAG = { bold: 'strong', italic: 'em', underline: 'u' } as const;

/** Thẻ HTML của tiêu đề theo cấp; cấp lạ thì dùng cấp 3. */
const HEADING_TAG: Record<number, string> = { 1: 'h1', 2: 'h2', 3: 'h3' };

/** Kiểu chữ của cả thư (trình đọc thư bỏ qua CSS ngoài, nên ghi thẳng vào thẻ). */
const LETTER_STYLE = 'font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2933';

/** Một bức thư đã dựng xong, sẵn để gửi. */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Thoát các kí tự đặc biệt của HTML, để chữ trong thư (kể cả dữ liệu người nộp đơn) không thành thẻ.
 * @param text  chữ thường
 * @returns     chữ an toàn để đặt vào HTML; xuống dòng thành <br>
 */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('\n', '<br>');
}

/**
 * Thay mã trong mọi đoạn chữ của văn bản.
 * Mã phải nằm gọn trong một đoạn chữ cùng định dạng (vd cả "{ho_ten}" cùng in đậm); trình soạn giữ nguyên mã khi chèn bằng nút.
 * @param node    nút cần thay
 * @param values  giá trị của từng mã
 * @returns       nút mới, đã thay mã
 */
function fillNode(node: RichTextNode, values: EmailTagValues): RichTextNode {
  if (node.type === 'text') return { ...node, text: fillEmailTemplate(node.text ?? '', values) };
  return node.content ? { ...node, content: node.content.map((child) => fillNode(child, values)) } : node;
}

/**
 * Một nút của văn bản thành HTML.
 * @param node        nút đã thay mã
 * @param inListItem  true: nút nằm ngay trong mục danh sách (đoạn không cần khoảng cách dưới)
 * @returns           đoạn HTML
 */
function nodeToHtml(node: RichTextNode, inListItem = false): string {
  const childrenHtml = (node.content ?? []).map((child) => nodeToHtml(child, node.type === 'listItem')).join('');

  // Chữ: thoát kí tự, rồi bọc các định dạng
  if (node.type === 'text') {
    return (node.marks ?? []).reduce((html, mark) => `<${MARK_TAG[mark.type]}>${html}</${MARK_TAG[mark.type]}>`, escapeHtml(node.text ?? ''));
  }

  // Các khối; đoạn trống vẫn giữ một dòng trống như trên trang soạn
  switch (node.type) {
    case 'doc':
      return childrenHtml;
    case 'paragraph':
      return `<p style="margin:${inListItem ? '0' : '0 0 12px'}">${childrenHtml || '<br>'}</p>`;
    case 'heading': {
      const tag = HEADING_TAG[Number(node.attrs?.['level'])] ?? 'h3';
      return `<${tag} style="margin:16px 0 8px">${childrenHtml}</${tag}>`;
    }
    case 'bulletList':
      return `<ul style="margin:0 0 12px;padding-left:24px">${childrenHtml}</ul>`;
    case 'orderedList': {
      const start = Number(node.attrs?.['start'] ?? 1);
      return `<ol style="margin:0 0 12px;padding-left:24px"${Number.isInteger(start) && start !== 1 ? ` start="${start}"` : ''}>${childrenHtml}</ol>`;
    }
    case 'listItem':
      return `<li>${childrenHtml}</li>`;
    case 'hardBreak':
      return '<br>';
  }
}

/**
 * Dựng bức thư: thay mã trong tiêu đề và nội dung, đổi nội dung sang HTML và chữ thường.
 * @param subject  tiêu đề có mã, vd '[{ma_don}] Đã nhận đơn'
 * @param body     nội dung có mã (văn bản có định dạng)
 * @param values   giá trị của từng mã
 * @returns        tiêu đề, HTML, chữ thường của thư
 */
export function buildEmailContent(subject: string, body: RichTextDoc, values: EmailTagValues): EmailContent {
  const filledBody = fillNode(body, values) as RichTextDoc;
  return {
    subject: fillEmailTemplate(subject, values),
    html: `<div style="${LETTER_STYLE}">${nodeToHtml(filledBody)}</div>`,
    text: richTextToPlainText(filledBody),
  };
}
