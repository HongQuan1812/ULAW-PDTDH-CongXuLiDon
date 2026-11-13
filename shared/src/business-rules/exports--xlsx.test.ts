import ExcelJS from 'exceljs';
import { describe, expect, test } from 'vitest';
import { FormSectionSchema } from '../aux-schema/form-types--sections';
import { checkXlsxTemplate, isReadableXlsx, renderXlsxTemplate } from './exports--xlsx';

/** Loại đơn thử: một câu chữ, một bảng có cột tính tổng. */
const sections = [
  FormSectionSchema.parse({
    id: 's1',
    title: 'A',
    questions: [
      { id: 'q1', type: 'text', label: 'Lý do' },
      {
        id: 'q2',
        type: 'table',
        label: 'Môn',
        tag: 'mon',
        rowName: 'môn',
        columns: [
          { label: 'Tên môn', type: 'text' },
          { label: 'Số tín chỉ', type: 'number', sum: true },
        ],
      },
    ],
  }),
];

/**
 * Dựng file mẫu: hàng 1 tiêu đề (mã chung), hàng 2 đầu cột, hàng 3 hàng mẫu của đơn (in đậm), hàng 4 dòng tổng.
 * @param cells  chữ các ô của hàng mẫu
 * @returns      nội dung file .xlsx
 */
async function makeTemplate(cells: string[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Đơn');
  sheet.addRow(['Thống kê {loai_don} ngày {ngay_xuat}']);
  sheet.addRow(['STT', 'Mã đơn', 'Lý do', 'Môn']);
  sheet.addRow(cells).font = { bold: true };
  sheet.addRow(['Tổng: {so_don} đơn']);
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

/**
 * Đọc lại các ô của trang tính đầu tiên.
 * @param bytes  nội dung file .xlsx
 * @returns      trang tính
 */
async function readSheet(bytes: ArrayBuffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return workbook.worksheets[0]!;
}

describe('renderXlsxTemplate', () => {
  test('nhân hàng mẫu theo số đơn, giữ định dạng; mã chung điền một lần; bảng gộp vào một ô; số giữ là số', async () => {
    const template = await makeTemplate(['{stt}', '{ma_don}', '{ly_do}', '{mon}', '{tong_so_tin_chi}']);
    const forms = [
      { ma_don: 'A-1', ly_do: 'Chuyển trường', mon: [{ stt: 1, ten_mon: 'Triết', so_tin_chi: 3 }], tong_so_tin_chi: 3 },
      { ma_don: 'A-2', ly_do: '', mon: [], tong_so_tin_chi: 0 },
    ];
    const sheet = await readSheet(await renderXlsxTemplate(template, forms, { so_don: 2, loai_don: 'Xét miễn môn', ngay_xuat: '13/11/2026' }));

    expect(sheet.getCell('A1').value).toBe('Thống kê Xét miễn môn ngày 13/11/2026');
    expect(sheet.getRow(3).values).toEqual([undefined, 1, 'A-1', 'Chuyển trường', '1. Triết · 3', 3]);
    expect(sheet.getRow(4).values).toEqual([undefined, 2, 'A-2', '', '', 0]);
    expect(sheet.getCell('B4').font?.bold).toBe(true);
    expect(sheet.getCell('A5').value).toBe('Tổng: 2 đơn');
  });

  test('không có đơn nào thì bỏ hàng mẫu', async () => {
    const sheet = await readSheet(await renderXlsxTemplate(await makeTemplate(['{ma_don}']), [], { so_don: 0 }));
    expect(sheet.getCell('A3').value).toBe('Tổng: 0 đơn');
  });
});

describe('checkXlsxTemplate', () => {
  test('mã cột của bảng không dùng được; báo ô thiếu ngoặc', async () => {
    const check = await checkXlsxTemplate(await makeTemplate(['{stt}', '{ma_don}', '{ten_mon}', '{ly_do']), sections);
    expect(check.unknown).toEqual(['ten_mon']);
    expect(check.found).toContain('so_don');
    expect(check.error).toContain('D3');
  });

  test('file không phải .xlsx thì không đọc được', async () => {
    expect(await isReadableXlsx(new TextEncoder().encode('không phải excel'))).toBe(false);
  });
});
