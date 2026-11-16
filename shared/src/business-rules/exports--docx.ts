/* Đọc, kiểm tra, điền mẫu xuất file Word bằng docxtemplater + PizZip.
   Câu hỏi dạng bảng không cần vòng lặp {#…} {/…}: hàng bảng hay đoạn văn nào có mã cột (hoặc {<mã bảng>_stt}) thì tự nhân lên
   theo số dòng của bảng, giống mẫu Excel. Một dòng có mã cột của nhiều bảng thì dòng thứ k điền dòng thứ k của từng bảng.
   Backend (api/src/exports) và API giả (web/src/mocks/handlers/exports.ts) cùng dùng. */
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { ExportTemplateCheck } from '../api-contract/exports';
import type { FormSection } from '../aux-schema/form-types--sections';
import { COMMON_EXPORT_TAG_GROUPS, knownExportTags, questionExportTags, rowNumberTag, rowTagTables, type ExportData, type QuestionExportTag } from './exports--tags';

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

/** Mã trong chữ trơn, kèm dấu đầu (#, /, ^, - của vòng lặp docxtemplater), vd "{ho_ten}", "{#mon}". */
const TAG_WITH_SIGN = /\{\s*([#/^-]?)\s*([^{}]*?)\s*\}/g;

/** Một hàng bảng Word (không chứa bảng con), hoặc một đoạn văn (trừ đoạn rỗng tự đóng <w:p/>). Gặp hàng bảng thì lấy cả hàng. */
const ROW_OR_PARAGRAPH_XML = /<w:tr(?:\s[^>]*)?>(?:(?!<w:tr[\s>])[\s\S])*?<\/w:tr>|<w:p(?:\s[^>]*)?(?<!\/)>[\s\S]*?<\/w:p>/g;

/** Các vòng lặp tự thêm: tên vòng lặp → các bảng mà dòng đó dùng. */
type RowLoops = Map<string, string[]>;

/**
 * Tự thêm vòng lặp cho mọi dòng có mã cột: hàng bảng thì nhân cả hàng ({-w:tr …}), đoạn văn thì nhân cả đoạn ({-w:p …}).
 * Sửa thẳng các phần XML của file đã mở.
 * @param zip         file Word đã mở
 * @param tableOfTag  mã cột / mã số thứ tự dòng → mã bảng (rowTagTables)
 * @returns           các vòng lặp đã thêm, để dựng dữ liệu cho chúng
 */
function addRowLoops(zip: PizZip, tableOfTag: ReadonlyMap<string, string>): RowLoops {
  const loops: RowLoops = new Map();
  for (const partName of textParts(zip)) {
    const xml = zip.file(partName)!.asText();
    const looped = xml.replace(ROW_OR_PARAGRAPH_XML, (unitXml) => {
      // Các bảng mà dòng này có mã cột, theo thứ tự gặp
      const tables = [...new Set([...plainText(unitXml).matchAll(TAG_WITH_SIGN)].flatMap(([, , tag = '']) => tableOfTag.get(tag) ?? []))];
      if (!tables.length) return unitXml;

      // Mở vòng lặp ở đầu chữ đầu tiên, đóng ở cuối chữ cuối cùng của dòng
      const loopName = `dong__${tables.join('__')}`;
      loops.set(loopName, tables);
      const kind = unitXml.startsWith('<w:tr') ? 'w:tr' : 'w:p';
      const opened = unitXml.replace(/<w:t(?:\s[^>]*)?>/, (textTag) => `${textTag}{-${kind} ${loopName}}`);
      const closeAt = opened.lastIndexOf('</w:t>');
      return `${opened.slice(0, closeAt)}{/${loopName}}${opened.slice(closeAt)}`;
    });
    if (looped !== xml) zip.file(partName, looped);
  }
  return loops;
}

/**
 * Dữ liệu của các vòng lặp tự thêm: dòng thứ k gộp dòng thứ k của từng bảng; bảng hết dòng thì các mã của nó để trống.
 * @param loops       vòng lặp đã thêm (addRowLoops)
 * @param exportData  giá trị theo mã, bảng là các dòng
 * @returns           tên vòng lặp → các dòng
 */
function rowLoopData(loops: RowLoops, exportData: ExportData): ExportData {
  return Object.fromEntries(
    [...loops].map(([loopName, tables]) => {
      const tableRows = tables.map((tableTag) => {
        const rows = exportData[tableTag];
        return Array.isArray(rows) ? rows : [];
      });
      const height = Math.max(0, ...tableRows.map((rows) => rows.length));
      return [loopName, Array.from({ length: height }, (_, k) => Object.assign({}, ...tableRows.map((rows) => rows[k] ?? {})) as Record<string, string | number>)];
    }),
  );
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
 * Kiểm tra mẫu theo các câu hỏi của loại đơn: mã không có trong loại đơn, mã vòng lặp {#…} {/…} không còn dùng, lỗi cú pháp.
 * @param bytes     nội dung file mẫu (đã biết là .docx đọc được)
 * @param sections  các phần của loại đơn (bản soạn hiện tại)
 * @returns         kết quả kiểm tra
 */
export function checkDocxTemplate(bytes: DocxBytes, sections: readonly FormSection[]): ExportTemplateCheck {
  const zip = new PizZip(bytes);
  const known = knownExportTags(sections);
  const [found, unknown, loopCodes] = [new Set<string>(), new Set<string>(), new Set<string>()];

  // Đọc từng mã; mã có dấu vòng lặp (#, /, ^, -) để riêng
  for (const partName of textParts(zip)) {
    for (const [, sign, tag = ''] of plainText(zip.file(partName)!.asText()).matchAll(TAG_WITH_SIGN)) {
      if (sign) loopCodes.add(`{${sign}${tag}}`);
      else {
        found.add(tag);
        if (!known.has(tag)) unknown.add(tag);
      }
    }
  }

  // Lỗi: còn mã vòng lặp (dòng có mã cột đã tự nhân lên); không thì để docxtemplater tự đọc mẫu sau khi thêm vòng lặp
  let error = '';
  if (loopCodes.size) error = `Không cần ${[...loopCodes].join(' ')} nữa: dòng có mã cột tự nhân lên theo số dòng của bảng. Hãy xóa các mã này.`;
  else {
    try {
      addRowLoops(zip, rowTagTables(sections));
      new Docxtemplater(zip, RENDER_OPTIONS);
    } catch (docxError) {
      error = explainDocxError(docxError);
    }
  }
  return { found: [...found], unknown: [...unknown], error };
}

/**
 * Điền dữ liệu vào mẫu: dòng có mã cột tự nhân lên theo số dòng của bảng, rồi điền mọi mã.
 * @param bytes       nội dung file mẫu
 * @param exportData  giá trị theo mã (buildExportData)
 * @param sections    các phần của lá đơn (bản chụp lúc nộp), để biết mã cột nào thuộc bảng nào
 * @returns           nội dung file Word đã điền; mẫu sai cú pháp thì ném lỗi (đổi thành câu báo bằng explainDocxError)
 */
export function renderDocxTemplate(bytes: DocxBytes, exportData: ExportData, sections: readonly FormSection[]): ArrayBuffer {
  const zip = new PizZip(bytes);
  const loops = addRowLoops(zip, rowTagTables(sections));
  const document = new Docxtemplater(zip, RENDER_OPTIONS);
  document.render({ ...exportData, ...rowLoopData(loops, exportData) });
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
 * Bảng có viền, thụt vào ngang chữ của gạch đầu dòng (nằm trong câu hỏi của nó): một hàng đầu cột và một hàng mã; hàng mã có mã cột nên khi xuất tự nhân lên mỗi dòng của câu trả lời.
 * @param question  câu hỏi dạng bảng
 * @returns         XML bảng
 */
function loopTableXml(question: QuestionExportTag): string {
  const columns = question.columns ?? [];
  // Bảng rộng vừa phần còn lại sau khi thụt, canh phải để mép trái lệch đúng bằng đó (cả Word và trình xem trên web đều hiểu cách canh này)
  const widths = [STT_COLUMN_WIDTH, ...columns.map(() => Math.floor((TABLE_WIDTH - STT_COLUMN_WIDTH) / Math.max(columns.length, 1)))];
  const cell = (text: string, width: number, bold = false) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraphXml([{ text, bold }])}</w:tc>`;
  const headerRow = `<w:tr>${['STT', ...columns.map((column) => column.label)].map((label, index) => cell(label, widths[index]!, true)).join('')}</w:tr>`;
  const loopCells = [`{${rowNumberTag(question.tag)}}`, ...columns.map((column) => `{${column.tag}}`)];
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
