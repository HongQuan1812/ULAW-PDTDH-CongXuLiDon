/* Đọc file Excel (.xlsx) thành các sheet dạng bảng chữ để xem trước. Thư viện exceljs tải khi cần. */

/** Số dòng, số cột tối đa mỗi sheet được dựng để xem trước (file lớn hơn thì cắt bớt, tải về để xem đủ). */
export const MAX_PREVIEW_ROWS = 500;
export const MAX_PREVIEW_COLUMNS = 40;

/** Một sheet để xem trước: các dòng đã bù đủ số cột, mỗi ô là chữ hiển thị. */
export interface PreviewSheet {
  name: string;
  rows: string[][];
  /** true khi sheet có nhiều dòng hoặc cột hơn giới hạn xem trước */
  isTruncated: boolean;
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
    return { name: worksheet.name, rows, isTruncated };
  });
}
