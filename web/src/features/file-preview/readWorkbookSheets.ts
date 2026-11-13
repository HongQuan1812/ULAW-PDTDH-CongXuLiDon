/* Đọc file Excel (.xlsx) thành các sheet dạng bảng chữ để xem trước. Thư viện exceljs tải khi cần. */

/** Số dòng, số cột tối đa mỗi sheet được dựng để xem trước (file lớn hơn thì cắt bớt, tải về để xem đủ). */
export const MAX_PREVIEW_ROWS = 500;
export const MAX_PREVIEW_COLUMNS = 40;

/** Một vùng ô gộp: vị trí ô trên cùng bên trái (từ 0) và số hàng, số cột của vùng. */
export interface PreviewMerge {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
}

/** Một sheet để xem trước: các dòng đã bù đủ số cột, mỗi ô là chữ hiển thị. */
export interface PreviewSheet {
  name: string;
  rows: string[][];
  /** Các vùng ô gộp (đã cắt cho vừa phần xem trước) */
  merges: PreviewMerge[];
  /** true khi sheet có nhiều dòng hoặc cột hơn giới hạn xem trước */
  isTruncated: boolean;
}

/**
 * Đổi tên cột Excel thành số thứ tự từ 0: A → 0, Z → 25, AA → 26.
 * @param label  tên cột, vd "AB"
 * @returns      số thứ tự cột
 */
function columnIndexOf(label: string): number {
  return [...label].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

/**
 * Đọc một vùng gộp dạng "B2:D3".
 * @param range  vùng gộp trong file
 * @returns      vị trí ô trên cùng bên trái (từ 0) và số hàng, số cột
 */
export function parseMergeRange(range: string): PreviewMerge {
  const [, firstColumn, firstRow, lastColumn, lastRow] = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range) ?? [];
  const row = Number(firstRow) - 1;
  const column = columnIndexOf(firstColumn ?? '');
  return { row, column, rowSpan: Number(lastRow) - 1 - row + 1, columnSpan: columnIndexOf(lastColumn ?? '') - column + 1 };
}

/**
 * Các vùng gộp của sheet, cắt cho vừa phần xem trước; vùng nằm ngoài hẳn thì bỏ.
 * @param mergeRanges  vùng gộp trong file, dạng "A1:B2"
 * @param rowCount     số dòng đang xem trước
 * @param columnCount  số cột đang xem trước
 * @returns            các vùng gộp để vẽ
 */
function visibleMerges(mergeRanges: readonly string[], rowCount: number, columnCount: number): PreviewMerge[] {
  return mergeRanges.map(parseMergeRange).flatMap((merge): PreviewMerge[] => {
    if (merge.row >= rowCount || merge.column >= columnCount) return [];
    return [{ ...merge, rowSpan: Math.min(merge.rowSpan, rowCount - merge.row), columnSpan: Math.min(merge.columnSpan, columnCount - merge.column) }];
  });
}

/**
 * Đọc toàn bộ sheet của một file .xlsx.
 * @param fileBuffer  nội dung file .xlsx
 * @returns           các sheet theo thứ tự trong file; sheet trống có rows rỗng
 * @throws            khi file không phải .xlsx hợp lệ
 */
export async function readWorkbookSheets(fileBuffer: ArrayBuffer): Promise<PreviewSheet[]> {
  // Tải thư viện khi cần, nạp file vào bộ nhớ
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(fileBuffer);

  return workbook.worksheets.map((worksheet) => {
    // Số dòng, cột đến ô cuối có dữ liệu, rồi cắt theo giới hạn xem trước
    const rowCount = Math.min(worksheet.actualRowCount > 0 ? worksheet.rowCount : 0, MAX_PREVIEW_ROWS);
    const columnCount = Math.min(worksheet.columnCount, MAX_PREVIEW_COLUMNS);

    // Dựng bảng chữ, ô trống thành chuỗi rỗng
    const rows: string[][] = [];
    for (let rowNumber = 1; rowNumber <= rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      rows.push(Array.from({ length: columnCount }, (_, columnIndex) => row.getCell(columnIndex + 1).text));
    }

    const isTruncated = worksheet.rowCount > MAX_PREVIEW_ROWS || worksheet.columnCount > MAX_PREVIEW_COLUMNS;
    return { name: worksheet.name, rows, merges: visibleMerges(worksheet.model.merges ?? [], rowCount, columnCount), isTruncated };
  });
}
