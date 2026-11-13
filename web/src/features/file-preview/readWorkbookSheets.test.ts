import ExcelJS from 'exceljs';
import { describe, expect, test } from 'vitest';
import { MAX_PREVIEW_COLUMNS, MAX_PREVIEW_ROWS, parseMergeRange, readWorkbookSheets } from './readWorkbookSheets';

/** Dựng file .xlsx trong bộ nhớ từ các sheet cho trước. */
async function buildWorkbook(sheets: Record<string, (string | number | null)[][]>): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(sheetName);
    rows.forEach((row) => sheet.addRow(row));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe('readWorkbookSheets', () => {
  test('trả về từng sheet theo thứ tự, mỗi ô là chữ hiển thị', async () => {
    const fileBuffer = await buildWorkbook({
      'Tổng hợp': [['Mã đơn', 'Số lượng'], ['XMM-2026-001-00001', 3]],
      'Chi tiết': [['Ghi chú']],
    });

    const sheets = await readWorkbookSheets(fileBuffer);

    expect(sheets.map((sheet) => sheet.name)).toEqual(['Tổng hợp', 'Chi tiết']);
    expect(sheets[0]!.rows).toEqual([['Mã đơn', 'Số lượng'], ['XMM-2026-001-00001', '3']]);
  });

  test('ô trống thành chuỗi rỗng, các dòng được bù cho đủ số cột', async () => {
    const fileBuffer = await buildWorkbook({ Sheet1: [['A', null, 'C'], ['D']] });

    const [sheet] = await readWorkbookSheets(fileBuffer);

    expect(sheet!.rows).toEqual([['A', '', 'C'], ['D', '', '']]);
  });

  test('sheet trống có rows rỗng', async () => {
    const fileBuffer = await buildWorkbook({ Trống: [] });

    const [sheet] = await readWorkbookSheets(fileBuffer);

    expect(sheet!.rows).toEqual([]);
    expect(sheet!.isTruncated).toBe(false);
  });

  test('cắt bớt khi quá nhiều dòng hoặc cột và đánh dấu isTruncated', async () => {
    const wideRow = Array.from({ length: MAX_PREVIEW_COLUMNS + 5 }, (_, index) => index);
    const manyRows = Array.from({ length: MAX_PREVIEW_ROWS + 5 }, () => wideRow);
    const fileBuffer = await buildWorkbook({ Lớn: manyRows });

    const [sheet] = await readWorkbookSheets(fileBuffer);

    expect(sheet!.rows).toHaveLength(MAX_PREVIEW_ROWS);
    expect(sheet!.rows[0]).toHaveLength(MAX_PREVIEW_COLUMNS);
    expect(sheet!.isTruncated).toBe(true);
  });

  test('báo lỗi khi file không phải xlsx hợp lệ', async () => {
    const notExcel = new TextEncoder().encode('khong phai excel').buffer as ArrayBuffer;

    await expect(readWorkbookSheets(notExcel)).rejects.toThrow();
  });
});

describe('ô gộp', () => {
  test('parseMergeRange đổi vùng gộp "B2:D3" thành vị trí từ 0 và số hàng, số cột', () => {
    expect(parseMergeRange('B2:D3')).toEqual({ row: 1, column: 1, rowSpan: 2, columnSpan: 3 });
    expect(parseMergeRange('AA10:AB10')).toEqual({ row: 9, column: 26, rowSpan: 1, columnSpan: 2 });
  });

  test('sheet trả về các vùng gộp trong file', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('S');
    sheet.addRow(['Môn', '']);
    sheet.addRow(['Tên', 'Tín']);
    sheet.mergeCells('A1:B1');
    const fileBuffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const [previewSheet] = await readWorkbookSheets(fileBuffer);

    expect(previewSheet!.merges).toEqual([{ row: 0, column: 0, rowSpan: 1, columnSpan: 2 }]);
  });

  test('vùng gộp vượt giới hạn xem trước thì bị cắt cho vừa, nằm ngoài hẳn thì bỏ', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('S');
    for (let rowNumber = 1; rowNumber <= MAX_PREVIEW_ROWS + 3; rowNumber++) sheet.addRow(['x', 'y']);
    sheet.mergeCells(MAX_PREVIEW_ROWS - 1, 1, MAX_PREVIEW_ROWS + 2, 1);
    sheet.mergeCells(MAX_PREVIEW_ROWS + 1, 2, MAX_PREVIEW_ROWS + 2, 2);
    const fileBuffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const [previewSheet] = await readWorkbookSheets(fileBuffer);

    expect(previewSheet!.merges).toEqual([{ row: MAX_PREVIEW_ROWS - 2, column: 0, rowSpan: 2, columnSpan: 1 }]);
  });
});
