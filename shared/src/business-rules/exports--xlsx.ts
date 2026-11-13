/* Đọc, kiểm tra, điền mẫu xuất file thống kê Excel (.xlsx) bằng ExcelJS.
   Cùng bộ mã với mẫu Word (exports--tags.ts), nhưng một file chứa nhiều lá đơn:
   - Hàng có mã của đơn (vd {ma_don}, {ho_ten}) là hàng mẫu: khi xuất, hàng đó nhân lên, mỗi lá đơn một hàng,
     giữ định dạng của hàng mẫu; {stt} là số thứ tự của đơn trong file.
   - Hàng chỉ có mã chung của file (STATS_SUMMARY_TAGS: {so_don}, {loai_don}, {ngay_xuat}) chỉ điền một lần, vd tiêu đề, dòng tổng.
   - Câu hỏi dạng bảng điền vào một ô, mỗi dòng của bảng một dòng trong ô; {so_<bảng>}, {tong_<cột>} điền như mẫu Word.
     Mã cột của bảng không dùng được (Excel không có vòng lặp).
   ExcelJS khá nặng nên chỉ tải khi cần (import động). Backend (api/src/exports) và API giả cùng dùng. */
import type { Cell, Row, Workbook, Worksheet } from 'exceljs';
import { EXPORT_MESSAGES, type ExportTemplateCheck, type ExportTemplatePurpose } from '../api-contract/exports';
import type { FormSection } from '../aux-schema/form-types--sections';
import { openDocx } from './exports--docx';
import { FORM_COUNT_TAG, ROW_NUMBER_TAG, STATS_SUMMARY_TAGS, columnTagOwners, knownExportTags, type ExportData } from './exports--tags';

/** Nội dung file: ArrayBuffer (trình duyệt) hoặc Buffer / Uint8Array (Node). */
export type XlsxBytes = ArrayBuffer | Uint8Array;

/** Giá trị điền vào một ô: chữ hoặc số (bảng đã gộp thành chữ). */
type SheetData = Record<string, string | number>;

/** Mã trong ngoặc nhọn, vd "{ho_ten}", "{ ma_don }". */
const TAG_IN_TEXT = /\{\s*([^{}]*?)\s*\}/g;

/** Cả ô chỉ có đúng một mã: giá trị số thì điền thành số (Excel cộng, lọc được). */
const WHOLE_CELL_TAG = /^\s*\{\s*([^{}]*?)\s*\}\s*$/;

/** Mã chung của file: hàng chỉ có các mã này không nhân lên theo đơn. */
const SUMMARY_TAG_SET: ReadonlySet<string> = new Set(STATS_SUMMARY_TAGS.map(({ tag }) => tag));

/**
 * Tải ExcelJS (lần đầu mới tải). Node trả module CommonJS trong `default`, trình duyệt (Vite) trả thẳng.
 * @returns  thư viện ExcelJS
 */
async function loadExcelJs(): Promise<Pick<typeof import('exceljs'), 'Workbook'>> {
  const excelModule = (await import('exceljs')) as unknown as { default?: Pick<typeof import('exceljs'), 'Workbook'>; Workbook?: unknown };
  return excelModule.default ?? (excelModule as Pick<typeof import('exceljs'), 'Workbook'>);
}

/**
 * Mở file Excel; không phải file .xlsx đọc được (hoặc không có trang tính nào) thì null.
 * @param bytes  nội dung file
 * @returns      sổ tính đã mở, hoặc null
 */
async function openWorkbook(bytes: XlsxBytes): Promise<Workbook | null> {
  try {
    const ExcelJS = await loadExcelJs();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as Parameters<Workbook['xlsx']['load']>[0]);
    return workbook.worksheets.length ? workbook : null;
  } catch {
    return null;
  }
}

/**
 * File có phải .xlsx đọc được không.
 * @param bytes  nội dung file
 * @returns      true nếu mở được
 */
export async function isReadableXlsx(bytes: XlsxBytes): Promise<boolean> {
  return (await openWorkbook(bytes)) !== null;
}

/**
 * File mẫu có đọc được theo mục đích không: mẫu đơn là .docx, mẫu thống kê là .xlsx.
 * @param bytes    nội dung file
 * @param purpose  mục đích của mẫu
 * @returns        true nếu đọc được
 */
export async function isReadableTemplateFile(bytes: XlsxBytes, purpose: ExportTemplatePurpose): Promise<boolean> {
  return purpose === 'form' ? openDocx(bytes) !== null : isReadableXlsx(bytes);
}

/**
 * Chữ trong một ô: chữ thường hoặc chữ nhiều định dạng; ô số, ngày, công thức, ô bị gộp vào ô khác thì null.
 * @param cell  ô
 * @returns     chữ, hoặc null
 */
function cellText(cell: Cell): string | null {
  if (cell.isMerged && cell.master.address !== cell.address) return null;
  const value = cell.value;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'richText' in value) return value.richText.map((run) => run.text).join('');
  return null;
}

/**
 * Các mã trong một đoạn chữ.
 * @param text  chữ trong ô
 * @returns     các mã, theo thứ tự
 */
function tagsIn(text: string): string[] {
  return [...text.matchAll(TAG_IN_TEXT)].map((match) => match[1] ?? '');
}

/**
 * Mọi mã trong một hàng.
 * @param row  hàng
 * @returns    các mã
 */
function rowTags(row: Row): string[] {
  const tags: string[] = [];
  row.eachCell((cell) => tags.push(...tagsIn(cellText(cell) ?? '')));
  return tags;
}

/**
 * Thay các mã trong một đoạn chữ; mã không có dữ liệu thì để trống.
 * @param text       chữ có mã
 * @param sheetData  giá trị theo mã
 * @returns          chữ đã điền
 */
function fillText(text: string, sheetData: SheetData): string {
  return text.replace(TAG_IN_TEXT, (_code, tag: string) => String(sheetData[tag] ?? ''));
}

/**
 * Điền một ô: ô chỉ có một mã mà giá trị là số thì điền số; chữ nhiều định dạng thì điền từng đoạn, giữ định dạng.
 * @param cell       ô
 * @param sheetData  giá trị theo mã
 */
function fillCell(cell: Cell, sheetData: SheetData): void {
  const text = cellText(cell);
  if (text === null || !text.includes('{')) return;
  const value = cell.value;

  // Cả ô là một mã số → số
  const wholeTag = WHOLE_CELL_TAG.exec(text)?.[1];
  if (wholeTag !== undefined && typeof sheetData[wholeTag] === 'number') {
    cell.value = sheetData[wholeTag];
    return;
  }

  // Còn lại: thay mã trong chữ
  if (typeof value === 'string') cell.value = fillText(value, sheetData);
  else if (value && typeof value === 'object' && 'richText' in value) {
    cell.value = { richText: value.richText.map((run) => ({ ...run, text: fillText(run.text, sheetData) })) };
  }
}

/**
 * Điền mọi ô của một hàng.
 * @param row        hàng
 * @param sheetData  giá trị theo mã
 */
function fillRow(row: Row, sheetData: SheetData): void {
  row.eachCell((cell) => fillCell(cell, sheetData));
}

/**
 * Gộp các dòng của câu hỏi dạng bảng thành chữ trong một ô: mỗi dòng một dòng, vd "1. Triết học · 3".
 * @param tableRows  các dòng theo mã cột (có stt)
 * @returns          chữ
 */
function tableText(tableRows: ReadonlyArray<Record<string, string | number>>): string {
  return tableRows
    .map(({ [ROW_NUMBER_TAG]: rowNumber, ...cells }) => {
      const cellTexts = Object.values(cells).map(String).filter((cell) => cell !== '');
      return `${rowNumber}. ${cellTexts.join(' · ')}`;
    })
    .join('\n');
}

/**
 * Đổi dữ liệu điền mẫu Word thành dữ liệu điền ô Excel: bảng gộp thành chữ.
 * @param exportData  giá trị theo mã (buildExportData)
 * @returns           chữ hoặc số theo mã
 */
function toSheetData(exportData: ExportData): SheetData {
  return Object.fromEntries(Object.entries(exportData).map(([tag, value]) => [tag, Array.isArray(value) ? tableText(value) : value]));
}

/**
 * Điền một trang tính: nhân hàng mẫu theo số đơn rồi điền từng đơn; sau đó điền mã chung ở các hàng còn lại.
 * @param sheet        trang tính
 * @param formsData    dữ liệu từng đơn (đã có stt)
 * @param summaryData  mã chung của file
 */
function fillSheet(sheet: Worksheet, formsData: readonly SheetData[], summaryData: SheetData): void {
  // Hàng mẫu: có mã không thuộc mã chung của file
  const templateRowNumbers: number[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowTags(row).some((tag) => !SUMMARY_TAG_SET.has(tag))) templateRowNumbers.push(rowNumber);
  });

  // Làm từ dưới lên, để hàng chèn thêm không làm lệch số hàng của các hàng mẫu phía trên.
  // Không có đơn nào thì bỏ hàng mẫu
  for (const rowNumber of templateRowNumbers.reverse()) {
    if (!formsData.length) {
      sheet.spliceRows(rowNumber, 1);
      continue;
    }
    if (formsData.length > 1) sheet.duplicateRow(rowNumber, formsData.length - 1, true);
    formsData.forEach((formData, index) => fillRow(sheet.getRow(rowNumber + index), { ...summaryData, ...formData }));
  }

  // Các hàng còn lại: mã chung của file
  sheet.eachRow((row) => fillRow(row, summaryData));
}

/**
 * Điền mẫu thống kê.
 * @param bytes        nội dung file mẫu
 * @param formsData    dữ liệu từng lá đơn theo thứ tự (buildExportData)
 * @param summaryData  mã chung của file: so_don, loai_don, ngay_xuat
 * @returns            nội dung file Excel đã điền; không đọc được mẫu thì ném lỗi
 */
export async function renderXlsxTemplate(bytes: XlsxBytes, formsData: readonly ExportData[], summaryData: ExportData): Promise<ArrayBuffer> {
  const workbook = await openWorkbook(bytes);
  if (!workbook) throw new Error(EXPORT_MESSAGES.unreadableXlsx);

  // Mỗi đơn có stt theo thứ tự trong file
  const sheetRows = formsData.map((formData, index) => ({ ...toSheetData(formData), [ROW_NUMBER_TAG]: index + 1 }));
  const summary = toSheetData(summaryData);
  workbook.worksheets.forEach((sheet) => fillSheet(sheet, sheetRows, summary));

  // Node trả Buffer, trình duyệt trả ArrayBuffer: đổi về một ArrayBuffer riêng
  const written = await workbook.xlsx.writeBuffer();
  return new Uint8Array(written as ArrayBuffer).slice().buffer;
}

/**
 * Mọi mã dùng được trong mẫu thống kê: như mẫu Word, bỏ mã cột của bảng, thêm {stt} (thứ tự đơn) và {so_don}.
 * @param sections  các phần của loại đơn
 * @returns         các mã
 */
export function knownStatsTags(sections: readonly FormSection[]): Set<string> {
  const known = knownExportTags(sections);
  for (const columnTagText of columnTagOwners(sections).keys()) known.delete(columnTagText);
  known.add(ROW_NUMBER_TAG);
  known.add(FORM_COUNT_TAG);
  return known;
}

/**
 * Kiểm tra mẫu thống kê theo các câu hỏi của loại đơn: mã không dùng được, ô thiếu dấu ngoặc.
 * @param bytes     nội dung file mẫu
 * @param sections  các phần của loại đơn (bản soạn hiện tại)
 * @returns         kết quả kiểm tra (outside luôn rỗng); không đọc được file thì báo ở error
 */
export async function checkXlsxTemplate(bytes: XlsxBytes, sections: readonly FormSection[]): Promise<ExportTemplateCheck> {
  const workbook = await openWorkbook(bytes);
  if (!workbook) return { found: [], unknown: [], outside: [], error: EXPORT_MESSAGES.unreadableXlsx };
  const known = knownStatsTags(sections);
  const [found, unknown] = [new Set<string>(), new Set<string>()];
  const braceErrors: string[] = [];

  // Đọc từng ô có chữ: ghi các mã; còn dấu ngoặc lẻ sau khi bỏ các mã thì báo ô đó
  workbook.worksheets.forEach((sheet) =>
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        const text = cellText(cell);
        if (text === null) return;
        for (const tag of tagsIn(text)) {
          found.add(tag);
          if (!known.has(tag)) unknown.add(tag);
        }
        if (/[{}]/.test(text.replace(TAG_IN_TEXT, ''))) braceErrors.push(`Thiếu dấu ngoặc ở ô ${sheet.name}!${cell.address}.`);
      }),
    ),
  );
  return { found: [...found], unknown: [...unknown], outside: [], error: braceErrors.slice(0, 5).join(' ') };
}
