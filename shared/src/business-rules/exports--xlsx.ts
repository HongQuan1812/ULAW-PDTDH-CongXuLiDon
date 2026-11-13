/* Đọc, kiểm tra, điền mẫu xuất file thống kê Excel (.xlsx) bằng ExcelJS.
   Cùng bộ mã với mẫu Word (exports--tags.ts), nhưng một file chứa nhiều lá đơn:
   - Hàng có mã của đơn (vd {ma_don}, {ho_ten}) là hàng mẫu: khi xuất, hàng đó nhân lên, mỗi lá đơn một hàng,
     giữ định dạng của hàng mẫu; {stt} là số thứ tự của đơn trong file.
   - Hàng chỉ có mã chung của file (STATS_SUMMARY_TAGS: {so_don}, {loai_don}, {ngay_xuat}) chỉ điền một lần, vd tiêu đề, dòng tổng.
   - Câu hỏi dạng bảng có hai cách đặt: cả bảng vào một ô ({<bảng>}, mỗi dòng của bảng một dòng trong ô),
     hoặc mỗi cột một ô ({<cột>}): đơn có n dòng thì chiếm n hàng, ô cột của bảng điền từng dòng,
     các ô còn lại của đơn gộp dọc n hàng. {stt_dong} là số thứ tự dòng của bảng. {so_<bảng>}, {tong_<cột>} điền như mẫu Word.
   ExcelJS khá nặng nên chỉ tải khi cần (import động). Backend (api/src/exports) và API giả cùng dùng. */
import type { Cell, Row, Workbook, Worksheet } from 'exceljs';
import { EXPORT_MESSAGES, type ExportTemplateCheck, type ExportTemplatePurpose } from '../api-contract/exports';
import type { FormSection } from '../aux-schema/form-types--sections';
import { openDocx } from './exports--docx';
import { FORM_COUNT_TAG, ROW_NUMBER_TAG, STATS_SUMMARY_TAGS, knownExportTags, questionExportTags, type ExportData } from './exports--tags';

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

/** Mã số thứ tự dòng của bảng (khác {stt} là số thứ tự của đơn trong file). */
export const TABLE_ROW_NUMBER_TAG = 'stt_dong';

/** Một đơn khi điền: giá trị các mã (bảng đã gộp thành chữ) và các bảng còn nguyên từng dòng. */
interface FormFill {
  sheetData: SheetData;
  tables: TableFill[];
}

/** Một bảng của đơn: mã các cột và các dòng (chỉ bảng có dòng mới biết mã cột). */
interface TableFill {
  columnTags: string[];
  rows: ReadonlyArray<Record<string, string | number>>;
}

/** Một ô của đơn gộp dọc: hàng đầu, hàng cuối, cột (số thứ tự từ 1). */
interface VerticalMerge {
  top: number;
  bottom: number;
  column: number;
}

/** Các ô gộp của một hàng mẫu, kèm số hàng mà hàng mẫu này làm thay đổi (để tính lại vị trí sau khi đã chèn hàng). */
interface TemplateRowMerges {
  templateRowNumber: number;
  addedRows: number;
  merges: VerticalMerge[];
}

/**
 * Các bảng của một đơn, giữ từng dòng.
 * @param formData  giá trị theo mã của đơn
 * @returns         các bảng có ít nhất một dòng
 */
function tablesOf(formData: ExportData): TableFill[] {
  return Object.values(formData).flatMap((value): TableFill[] => {
    if (!Array.isArray(value) || !value.length) return [];
    return [{ columnTags: Object.keys(value[0]!).filter((tag) => tag !== ROW_NUMBER_TAG), rows: value }];
  });
}

/**
 * Giá trị các cột của bảng ở dòng thứ k của đơn; bảng hết dòng thì để trống.
 * Hai bảng trùng mã cột thì bảng đứng trước được dùng.
 * @param tables  các bảng của đơn đang dùng trong hàng mẫu
 * @param k       thứ tự dòng, từ 0
 * @returns       giá trị theo mã, có {stt_dong}
 */
function tableRowData(tables: readonly TableFill[], k: number): SheetData {
  const rowData: SheetData = {};
  for (const table of [...tables].reverse()) {
    Object.entries(table.rows[k] ?? {}).forEach(([tag, value]) => {
      if (tag !== ROW_NUMBER_TAG) rowData[tag] = value;
    });
  }
  if (tables.some((table) => table.rows.length > k)) rowData[TABLE_ROW_NUMBER_TAG] = k + 1;
  return rowData;
}

/**
 * Các cột của hàng mẫu thuộc cả đơn (gộp dọc khi đơn chiếm nhiều hàng): mọi ô, trừ ô có mã cột của bảng hoặc {stt_dong}, và ô đã gộp ngang.
 * @param row          hàng mẫu
 * @param tableTagSet  mọi mã cột của bảng trong dữ liệu
 * @returns            số cột (từ 1)
 */
function perFormColumns(row: Row, tableTagSet: ReadonlySet<string>): number[] {
  const columns: number[] = [];
  for (let column = 1; column <= row.worksheet.columnCount; column++) {
    const cell = row.getCell(column);
    if (cell.isMerged) continue;
    if (!tagsIn(cellText(cell) ?? '').some((tag) => tableTagSet.has(tag))) columns.push(column);
  }
  return columns;
}

/**
 * Điền một trang tính: mỗi hàng mẫu nhân lên cho từng đơn (đơn có bảng n dòng chiếm n hàng, ô của đơn gộp dọc);
 * sau đó điền mã chung ở các hàng còn lại.
 * @param sheet        trang tính
 * @param forms        các đơn (đã có stt)
 * @param summaryData  mã chung của file
 */
function fillSheet(sheet: Worksheet, forms: readonly FormFill[], summaryData: SheetData): void {
  // Hàng mẫu: có mã không thuộc mã chung của file
  const templateRowNumbers: number[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowTags(row).some((tag) => !SUMMARY_TAG_SET.has(tag))) templateRowNumbers.push(rowNumber);
  });
  const tableTagSet = new Set([TABLE_ROW_NUMBER_TAG, ...forms.flatMap((form) => form.tables.flatMap((table) => table.columnTags))]);

  // Làm từ dưới lên, để hàng chèn thêm không làm lệch số hàng của các hàng mẫu phía trên.
  // Không có đơn nào thì bỏ hàng mẫu
  const mergesByTemplateRow: TemplateRowMerges[] = [];
  for (const templateRowNumber of templateRowNumbers.reverse()) {
    if (!forms.length) {
      sheet.spliceRows(templateRowNumber, 1);
      mergesByTemplateRow.push({ templateRowNumber, addedRows: -1, merges: [] });
      continue;
    }

    // Mỗi đơn chiếm bao nhiêu hàng: số dòng của bảng dài nhất trong các bảng mà hàng mẫu dùng
    const templateRow = sheet.getRow(templateRowNumber);
    const templateTags = new Set(rowTags(templateRow));
    const perForm = perFormColumns(templateRow, tableTagSet);
    const usedTables = forms.map((form) => form.tables.filter((table) => table.columnTags.some((tag) => templateTags.has(tag))));
    const heights = usedTables.map((tables) => Math.max(1, ...tables.map((table) => table.rows.length)));
    const totalRows = heights.reduce((sum, height) => sum + height, 0);
    if (totalRows > 1) sheet.duplicateRow(templateRowNumber, totalRows - 1, true);

    // Điền từng đơn: mọi hàng của đơn điền cùng dữ liệu đơn kèm dòng bảng tương ứng; ô của đơn gộp dọc lại
    const merges: VerticalMerge[] = [];
    let blockTop = templateRowNumber;
    forms.forEach((form, formIndex) => {
      const height = heights[formIndex]!;
      for (let k = 0; k < height; k++) {
        fillRow(sheet.getRow(blockTop + k), { ...summaryData, ...form.sheetData, ...tableRowData(usedTables[formIndex]!, k) });
      }
      if (height > 1) perForm.forEach((column) => merges.push({ top: blockTop, bottom: blockTop + height - 1, column }));
      blockTop += height;
    });
    mergesByTemplateRow.push({ templateRowNumber, addedRows: totalRows - 1, merges });
  }

  // Gộp ô sau cùng (khi số hàng đã chốt): vị trí dời xuống theo số hàng chèn thêm ở các hàng mẫu phía trên
  let shift = 0;
  for (const { addedRows, merges } of mergesByTemplateRow.reverse()) {
    merges.forEach(({ top, bottom, column }) => sheet.mergeCells(top + shift, column, bottom + shift, column));
    shift += addedRows;
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
  const forms = formsData.map((formData, index): FormFill => ({ sheetData: { ...toSheetData(formData), [ROW_NUMBER_TAG]: index + 1 }, tables: tablesOf(formData) }));
  const summary = toSheetData(summaryData);
  workbook.worksheets.forEach((sheet) => fillSheet(sheet, forms, summary));

  // Node trả Buffer, trình duyệt trả ArrayBuffer: đổi về một ArrayBuffer riêng
  const written = await workbook.xlsx.writeBuffer();
  return new Uint8Array(written as ArrayBuffer).slice().buffer;
}

/**
 * Mọi mã dùng được trong mẫu thống kê: như mẫu Word (có mã cột của bảng), thêm {stt} (thứ tự đơn), {stt_dong} (thứ tự dòng bảng) và {so_don}.
 * @param sections  các phần của loại đơn
 * @returns         các mã
 */
export function knownStatsTags(sections: readonly FormSection[]): Set<string> {
  const known = knownExportTags(sections);
  known.add(ROW_NUMBER_TAG);
  known.add(TABLE_ROW_NUMBER_TAG);
  known.add(FORM_COUNT_TAG);
  return known;
}

/** Một cột của file mẫu dựng sẵn: chữ ở đầu cột, mã ở hàng mẫu, và (nếu là cột của câu hỏi dạng bảng) tên câu hỏi đó. */
export interface StatsStarterColumn {
  header: string;
  tag: string;
  tableLabel?: string;
}

/** Các cột chung đứng đầu file mẫu dựng sẵn; sau đó là từng câu hỏi của loại đơn. */
export const STATS_STARTER_COMMON_COLUMNS: readonly StatsStarterColumn[] = [
  { header: 'STT', tag: ROW_NUMBER_TAG },
  { header: 'Mã đơn', tag: 'ma_don' },
  { header: 'Họ và tên', tag: 'ho_ten' },
  { header: 'MSSV', tag: 'mssv' },
  { header: 'Lớp', tag: 'lop' },
  { header: 'Ngày nộp', tag: 'ngay_nop' },
  { header: 'Trạng thái', tag: 'trang_thai' },
];

/**
 * Các cột của file mẫu dựng sẵn: cột chung, rồi mỗi câu hỏi một cột;
 * câu dạng bảng thành một cột cho mỗi cột của bảng (có tableLabel), rồi thêm cột tổng của các cột tính tổng.
 * @param sections  các phần của loại đơn
 * @returns         các cột theo thứ tự
 */
export function statsStarterColumns(sections: readonly FormSection[]): StatsStarterColumn[] {
  const questionColumns = questionExportTags(sections).flatMap((question): StatsStarterColumn[] => {
    if (!question.columns) return [{ header: question.label, tag: question.tag }];
    const tableColumns = question.columns.map((column) => ({ header: column.label, tag: column.tag, tableLabel: question.label }));
    const sumColumns = question.columns.filter((column) => column.sum).map((column) => ({ header: `Tổng ${column.label.toLowerCase()}`, tag: `tong_${column.tag}` }));
    return [...tableColumns, ...sumColumns];
  });
  return [...STATS_STARTER_COMMON_COLUMNS, ...questionColumns];
}

/** Hàng đầu cột (tầng trên), hàng tên cột của bảng (tầng dưới) và hàng mẫu của file mẫu dựng sẵn. */
const STARTER_HEADER_TOP_ROW = 4;
const STARTER_HEADER_BOTTOM_ROW = 5;
const STARTER_TEMPLATE_ROW = 6;

/**
 * Dựng sẵn một file mẫu thống kê để người soạn tải về rồi sửa:
 * hàng 1–2 tiêu đề (mã của cả file, điền một lần); hàng 4–5 đầu cột hai tầng:
 * cột thường gộp dọc hai hàng, câu hỏi dạng bảng gộp ngang trên các cột của nó, tên cột ở tầng dưới;
 * hàng 6 hàng mẫu (mã của đơn, nhân lên mỗi đơn một hàng, đơn có bảng n dòng thì n hàng).
 * @param sections  các phần của loại đơn
 * @returns         nội dung file .xlsx
 */
export async function createStatsStarterXlsx(sections: readonly FormSection[]): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Thống kê', { views: [{ state: 'frozen', ySplit: STARTER_HEADER_BOTTOM_ROW }] });
  const columns = statsStarterColumns(sections);
  const border = { style: 'thin', color: { argb: 'FFBFBFBF' } } as const;
  const cellBorder = { top: border, left: border, bottom: border, right: border };
  const headerStyle = {
    font: { bold: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } },
    border: cellBorder,
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
  } as const;

  // Tiêu đề: chỉ có mã của cả file nên điền một lần
  sheet.getCell('A1').value = 'Danh sách đơn {loai_don}';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A2').value = 'Ngày xuất: {ngay_xuat} · Số đơn: {so_don}';
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };

  // Đầu cột: tô kiểu cho cả hai tầng; cột của bảng có chữ tên câu hỏi ở tầng trên và tên cột ở tầng dưới, cột thường chỉ có một chữ
  columns.forEach((column, index) => {
    const columnNumber = index + 1;
    const topCell = sheet.getCell(STARTER_HEADER_TOP_ROW, columnNumber);
    const bottomCell = sheet.getCell(STARTER_HEADER_BOTTOM_ROW, columnNumber);
    topCell.value = column.tableLabel ?? column.header;
    if (column.tableLabel) bottomCell.value = column.header;
    [topCell, bottomCell].forEach((headerCell) => Object.assign(headerCell, headerStyle));

    const templateCell = sheet.getCell(STARTER_TEMPLATE_ROW, columnNumber);
    templateCell.value = `{${column.tag}}`;
    templateCell.border = cellBorder;
    templateCell.alignment = { vertical: 'top', wrapText: true };
  });

  // Gộp ô đầu cột: cột thường gộp dọc hai tầng; các cột liền nhau của cùng một bảng gộp ngang ở tầng trên
  columns.forEach((column, index) => {
    if (!column.tableLabel) sheet.mergeCells(STARTER_HEADER_TOP_ROW, index + 1, STARTER_HEADER_BOTTOM_ROW, index + 1);
    else if (columns[index - 1]?.tableLabel !== column.tableLabel) {
      const lastColumnIndex = index + columns.filter((other) => other.tableLabel === column.tableLabel).length - 1;
      if (lastColumnIndex > index) sheet.mergeCells(STARTER_HEADER_TOP_ROW, index + 1, STARTER_HEADER_TOP_ROW, lastColumnIndex + 1);
    }
  });

  // Độ rộng cột theo chữ ở đầu cột và mã, trong khoảng 6–40
  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = Math.min(40, Math.max(6, column.header.length, column.tag.length + 2) + 2);
  });

  const written = await workbook.xlsx.writeBuffer();
  return new Uint8Array(written as ArrayBuffer).slice().buffer;
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
