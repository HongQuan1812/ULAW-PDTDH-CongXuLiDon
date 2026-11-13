/* Đọc, kiểm tra, điền mẫu xuất file Word bằng docxtemplater + PizZip.
   Backend (api/src/exports) và API giả (web/src/mocks/handlers/exports.ts) cùng dùng. */
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { ExportTemplateCheck } from '../api-contract/exports';
import type { FormSection } from '../aux-schema/form-types--sections';
import { COMMON_EXPORT_TAG_GROUPS, ROW_NUMBER_TAG, columnTagOwners, knownExportTags, questionExportTags, type ExportData, type QuestionExportTag } from './exports--tags';

/** Nội dung file: ArrayBuffer (trình duyệt) hoặc Buffer / Uint8Array (Node). */
export type DocxBytes = ArrayBuffer | Uint8Array;

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
export function openDocx(bytes: DocxBytes): PizZip | null {
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
export function checkDocxTemplate(bytes: DocxBytes, sections: readonly FormSection[]): ExportTemplateCheck {
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
export function renderDocxTemplate(bytes: DocxBytes, exportData: ExportData): ArrayBuffer {
  const document = new Docxtemplater(new PizZip(bytes), RENDER_OPTIONS);
  document.render(exportData);
  // Nén lại như file Word thường (mặc định PizZip không nén, file nặng gấp nhiều lần)
  return document.getZip().generate({ type: 'arraybuffer', compression: 'DEFLATE' });
}

/* ---------- File mẫu dựng sẵn ---------- */

/** Chữ thoát kí tự đặc biệt của XML. */
function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Một đoạn văn của file Word; mã {...} luôn nằm trong một đoạn chữ để Word không tách mã.
 * @param runs  các đoạn chữ: chữ và có in đậm hay không
 * @param size  cỡ chữ theo nửa điểm (28 = 14pt); bỏ trống = cỡ mặc định
 * @param isBullet  có gạch đầu dòng không (dùng danh sách numbering.xml của file mẫu)
 * @returns     XML đoạn văn
 */
function paragraphXml(runs: ReadonlyArray<{ text: string; bold?: boolean }>, size?: number, isBullet = false): string {
  const runsXml = runs
    .map(({ text, bold }) => `<w:r><w:rPr>${bold ? '<w:b/>' : ''}${size ? `<w:sz w:val="${size}"/>` : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`)
    .join('');
  const bulletXml = isBullet ? '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' : '';
  return `<w:p>${bulletXml}${runsXml}</w:p>`;
}

/** Khổ A4 trừ lề 2 bên (9638) trừ phần thụt dưới gạch đầu dòng (720); cột STT. Đơn vị twip. */
const TABLE_WIDTH = 8918;
const STT_COLUMN_WIDTH = 900;

/**
 * Bảng có viền, thụt vào ngang chữ của gạch đầu dòng (nằm trong câu hỏi của nó): một hàng đầu cột và một hàng mã; hàng mã mở vòng lặp ở ô đầu và đóng ở ô cuối nên nhân lên mỗi dòng của câu trả lời.
 * @param question  câu hỏi dạng bảng
 * @returns         XML bảng
 */
function loopTableXml(question: QuestionExportTag): string {
  const columns = question.columns ?? [];
  // Bảng rộng vừa phần còn lại sau khi thụt, canh phải để mép trái lệch đúng bằng đó (cả Word và trình xem trên web đều hiểu cách canh này)
  const widths = [STT_COLUMN_WIDTH, ...columns.map(() => Math.floor((TABLE_WIDTH - STT_COLUMN_WIDTH) / Math.max(columns.length, 1)))];
  const cell = (text: string, width: number, bold = false) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraphXml([{ text, bold }])}</w:tc>`;
  const headerRow = `<w:tr>${['STT', ...columns.map((column) => column.label)].map((label, index) => cell(label, widths[index]!, true)).join('')}</w:tr>`;
  const loopCells = [`{#${question.tag}}{${ROW_NUMBER_TAG}}`, ...columns.map((column, index) => `{${column.tag}}${index === columns.length - 1 ? `{/${question.tag}}` : ''}`)];
  const loopRow = `<w:tr>${loopCells.map((text, index) => cell(text, widths[index]!)).join('')}</w:tr>`;
  const border = (side: string) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`;
  const borders = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>`;
  const grid = `<w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${TABLE_WIDTH}" w:type="dxa"/><w:jc w:val="right"/>${borders}<w:tblLayout w:type="fixed"/></w:tblPr>${grid}${headerRow}${loopRow}</w:tbl>`;
}

/** Số La Mã đánh số các mục của file mẫu. */
const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V'] as const;

/**
 * Dựng sẵn một file Word mẫu để người soạn tải về rồi sửa: tiêu đề, đủ mọi mã chung của Bảng mã (người nộp đơn, thông tin đơn),
 * rồi mỗi câu hỏi một dòng "tên câu hỏi: {mã}"; câu hỏi dạng bảng là bảng có vòng lặp.
 * @param sections  các phần của loại đơn
 * @returns         nội dung file .docx
 */
export function createFormStarterDocx(sections: readonly FormSection[]): ArrayBuffer {
  const labelLine = (label: string, tag: string) => paragraphXml([{ text: `${label}: `, bold: true }, { text: `{${tag}}` }], undefined, true);
  // Mã chung: mỗi nhóm của Bảng mã (Người nộp đơn, Thông tin đơn) một mục, mỗi mã một dòng "tên: {mã}"
  const commonParagraphs = COMMON_EXPORT_TAG_GROUPS.flatMap((group, index) => [
    paragraphXml([{ text: `${ROMAN_NUMERALS[index]}. ${group.title.toUpperCase()}`, bold: true }]),
    ...group.tags.map(({ tag, label }) => labelLine(label, tag)),
  ]);
  const answerParagraphs = questionExportTags(sections).flatMap((question) =>
    question.columns ? [paragraphXml([{ text: `${question.label}:`, bold: true }], undefined, true), loopTableXml(question), paragraphXml([])] : [labelLine(question.label, question.tag)],
  );
  const body = [
    paragraphXml([{ text: '{loai_don}', bold: true }], 32),
    ...commonParagraphs,
    paragraphXml([{ text: `${ROMAN_NUMERALS[COMMON_EXPORT_TAG_GROUPS.length]}. CÂU TRẢ LỜI TRONG ĐƠN`, bold: true }]),
    ...answerParagraphs,
  ].join('');
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  // Các phần tối thiểu của một file .docx; numbering.xml khai báo danh sách gạch đầu dòng (numId 1)
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    'word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>',
  );
  zip.file(
    'word/numbering.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>',
  );
  zip.file('word/document.xml', documentXml);
  return zip.generate({ type: 'arraybuffer', compression: 'DEFLATE' });
}
