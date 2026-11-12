/* API giả: đọc, kiểm tra, điền mẫu xuất file Word bằng docxtemplater + PizZip.
   Backend thật làm đúng việc này ở máy chủ (api/src/exports). */
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { columnTagOwners, knownExportTags, type ExportData, type ExportTemplateCheck, type FormSection } from '@ulaw/shared';

/** Tùy chọn điền mẫu: vòng lặp theo đoạn văn, giữ xuống dòng, mã không có dữ liệu thì để trống. */
const RENDER_OPTIONS = { paragraphLoop: true, linebreaks: true, nullGetter: () => '' } as const;

/**
 * Các phần XML có chữ của file Word: thân văn bản, đầu trang, chân trang.
 * @param zip  file Word đã mở
 * @returns    tên các phần, vd 'word/document.xml'
 */
function textParts(zip: PizZip): string[] {
  return Object.keys(zip.files).filter((partName) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(partName));
}

/**
 * Chữ trơn của một phần XML (bỏ thẻ), để tìm mã trường dù Word tách mã thành nhiều đoạn định dạng.
 * @param xml  nội dung XML
 * @returns    chữ trơn
 */
function plainText(xml: string): string {
  return xml.replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '');
}

/**
 * Đổi lỗi của docxtemplater thành câu dễ hiểu.
 * @param error  lỗi docxtemplater ném ra
 * @returns      câu báo, tối đa 5 lỗi đầu
 */
export function explainDocxError(error: unknown): string {
  type DocxError = { message?: string; properties?: { id?: string; xtag?: string; context?: string; errors?: DocxError[] } };
  const docxError = error as DocxError;
  const errors = docxError.properties?.errors ?? [docxError];
  return errors
    .slice(0, 5)
    .map((item) => {
      const { id = '', xtag, context } = item.properties ?? {};
      if (id === 'unclosed_tag' || id === 'unopened_tag') return `Thiếu dấu ngoặc ở mã “${xtag ?? context ?? '?'}”.`;
      if (id === 'unclosed_loop' || id === 'closing_tag_does_not_match_opening_tag' || id === 'unopened_loop') {
        return `Vòng lặp “${xtag ?? '?'}” chưa có cặp {#…} {/…} khớp nhau.`;
      }
      if (id === 'duplicate_open_tag' || id === 'duplicate_close_tag') return `Có hai dấu ngoặc liền nhau ở “${xtag ?? '?'}”.`;
      return item.message ?? String(item);
    })
    .join(' ');
}

/**
 * Mở file Word; không phải file .docx đọc được thì null.
 * @param bytes  nội dung file
 * @returns      file đã mở, hoặc null
 */
export function openDocx(bytes: ArrayBuffer): PizZip | null {
  try {
    const zip = new PizZip(bytes);
    return zip.file('word/document.xml') ? zip : null;
  } catch {
    return null;
  }
}

/**
 * Kiểm tra mẫu theo các câu hỏi của loại đơn: mã không có trong loại đơn, mã cột đặt ngoài vòng lặp, lỗi cú pháp.
 * @param bytes     nội dung file mẫu (đã biết là .docx đọc được)
 * @param sections  các phần của loại đơn (bản soạn hiện tại)
 * @returns         kết quả kiểm tra
 */
export function checkDocxTemplate(bytes: ArrayBuffer, sections: readonly FormSection[]): ExportTemplateCheck {
  const zip = new PizZip(bytes);
  const known = knownExportTags(sections);
  const owners = columnTagOwners(sections);
  const [found, unknown, outside] = [new Set<string>(), new Set<string>(), new Set<string>()];

  // Đọc từng mã theo thứ tự; nhớ các vòng lặp đang mở để biết mã cột có nằm trong vòng lặp của bảng không
  for (const partName of textParts(zip)) {
    const openLoops: string[] = [];
    for (const match of plainText(zip.file(partName)!.asText()).matchAll(/\{\s*([#/^]?)\s*([^{}]*?)\s*\}/g)) {
      const [, sign, tag = ''] = match;
      found.add(tag);
      if (!known.has(tag)) unknown.add(tag);
      if (sign === '#' || sign === '^') openLoops.push(tag);
      else if (sign === '/') {
        const index = openLoops.lastIndexOf(tag);
        if (index >= 0) openLoops.splice(index);
      } else if (owners.has(tag) && !owners.get(tag)!.some((tableTag) => openLoops.includes(tableTag))) outside.add(tag);
    }
  }

  // Lỗi cú pháp: để docxtemplater tự đọc mẫu
  let error = '';
  try {
    new Docxtemplater(zip, RENDER_OPTIONS);
  } catch (docxError) {
    error = explainDocxError(docxError);
  }
  return { found: [...found], unknown: [...unknown], outside: [...outside], error };
}

/**
 * Điền dữ liệu vào mẫu.
 * @param bytes       nội dung file mẫu
 * @param exportData  giá trị theo mã
 * @returns           nội dung file Word đã điền; mẫu sai cú pháp thì ném lỗi (đổi thành câu báo bằng explainDocxError)
 */
export function renderDocxTemplate(bytes: ArrayBuffer, exportData: ExportData): ArrayBuffer {
  const document = new Docxtemplater(new PizZip(bytes), RENDER_OPTIONS);
  document.render(exportData);
  // Nén lại như file Word thường (mặc định PizZip không nén, file nặng gấp nhiều lần)
  return document.getZip().generate({ type: 'arraybuffer', compression: 'DEFLATE' });
}
