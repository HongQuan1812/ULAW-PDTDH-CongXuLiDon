import ExcelJS from 'exceljs';
import { describe, expect, test } from 'vitest';
import { FormSectionSchema } from '../aux-schema/form-types--sections';
import { checkXlsxTemplate, createStatsStarterXlsx, isReadableXlsx, renderXlsxTemplate } from './exports--xlsx';

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

describe('bảng nhiều dòng (gộp ô)', () => {
  test('đơn có bảng n dòng thì chiếm n hàng: cột của bảng điền từng dòng, các ô khác gộp dọc lại', async () => {
    const template = await makeTemplate(['{stt}', '{ma_don}', '{ten_mon}', '{so_tin_chi}', '{tong_so_tin_chi}']);
    const forms = [
      {
        ma_don: 'A-1',
        mon: [
          { stt: 1, ten_mon: 'Triết', so_tin_chi: 3 },
          { stt: 2, ten_mon: 'Luật', so_tin_chi: 2 },
          { stt: 3, ten_mon: 'Tin', so_tin_chi: 4 },
        ],
        tong_so_tin_chi: 9,
      },
      { ma_don: 'A-2', mon: [], tong_so_tin_chi: 0 },
      { ma_don: 'A-3', mon: [{ stt: 1, ten_mon: 'Anh', so_tin_chi: 5 }], tong_so_tin_chi: 5 },
    ];
    const sheet = await readSheet(await renderXlsxTemplate(template, forms, { so_don: 3 }));

    // Đơn 1 chiếm hàng 3–5, mỗi hàng một môn; đơn 2 một hàng trống; đơn 3 một hàng
    expect([3, 4, 5].map((row) => [sheet.getCell(`C${row}`).value, sheet.getCell(`D${row}`).value])).toEqual([['Triết', 3], ['Luật', 2], ['Tin', 4]]);
    expect([sheet.getCell('B6').value, sheet.getCell('C6').value]).toEqual(['A-2', '']);
    expect([sheet.getCell('B7').value, sheet.getCell('C7').value, sheet.getCell('D7').value]).toEqual(['A-3', 'Anh', 5]);
    expect(sheet.getCell('A8').value).toBe('Tổng: 3 đơn');

    // Ô của đơn (stt, mã đơn, tổng) gộp dọc theo số dòng của bảng; cột của bảng không gộp; đơn 1 dòng không gộp
    expect(sheet.getCell('A3').value).toBe(1);
    expect(sheet.getCell('B3').value).toBe('A-1');
    expect(sheet.getCell('E3').value).toBe(9);
    expect([...sheet.model.merges].sort()).toEqual(['A3:A5', 'B3:B5', 'E3:E5']);
  });

  test('{stt_dong} là số thứ tự dòng của bảng, đánh lại từ 1 ở mỗi đơn', async () => {
    const template = await makeTemplate(['{ma_don}', '{stt_dong}', '{ten_mon}']);
    const forms = [
      { ma_don: 'A-1', mon: [{ stt: 1, ten_mon: 'Triết' }, { stt: 2, ten_mon: 'Luật' }] },
      { ma_don: 'A-2', mon: [{ stt: 1, ten_mon: 'Anh' }] },
    ];
    const sheet = await readSheet(await renderXlsxTemplate(template, forms, { so_don: 2 }));
    expect([3, 4, 5].map((row) => [sheet.getCell(`B${row}`).value, sheet.getCell(`C${row}`).value])).toEqual([[1, 'Triết'], [2, 'Luật'], [1, 'Anh']]);
  });

  test('hai bảng trong một đơn thì số hàng theo bảng dài hơn, bảng ngắn để trống phần còn lại', async () => {
    const template = await makeTemplate(['{ma_don}', '{ten_mon}', '{ten_giay_to}']);
    const forms = [
      { ma_don: 'A-1', mon: [{ stt: 1, ten_mon: 'Triết' }, { stt: 2, ten_mon: 'Luật' }], giay_to: [{ stt: 1, ten_giay_to: 'Bảng điểm' }] },
    ];
    const sheet = await readSheet(await renderXlsxTemplate(template, forms, { so_don: 1 }));
    expect([3, 4].map((row) => [sheet.getCell(`B${row}`).value, sheet.getCell(`C${row}`).value])).toEqual([['Triết', 'Bảng điểm'], ['Luật', '']]);
    // Cột D của bảng mẫu không có mã, thuộc cả đơn nên cũng gộp cho đều
    expect([...sheet.model.merges].sort()).toEqual(['A3:A4', 'D3:D4']);
  });
});

describe('createStatsStarterXlsx', () => {
  test('file mẫu dựng sẵn: đầu cột 2 tầng (tên câu bảng gộp ngang trên các cột), mã ở hàng mẫu; không mã sai; xuất được', async () => {
    const starter = await createStatsStarterXlsx(sections);
    const sheet = await readSheet(starter);
    expect(sheet.getCell('A1').value).toBe('Danh sách đơn {loai_don}');

    // Tầng trên: cột thường gộp dọc 2 hàng đầu cột; câu hỏi dạng bảng gộp ngang trên các cột của nó
    expect(sheet.getRow(4).getCell(1).value).toBe('STT');
    expect(sheet.getCell('H4').value).toBe('Lý do');
    expect(sheet.getCell('I4').value).toBe('Môn');
    expect(sheet.getCell('K4').value).toBe('Tổng số tín chỉ');
    expect([...sheet.model.merges]).toEqual(expect.arrayContaining(['A4:A5', 'H4:H5', 'I4:J4', 'K4:K5']));

    // Tầng dưới: tên cột của bảng; hàng mẫu: mã
    expect([sheet.getCell('I5').value, sheet.getCell('J5').value]).toEqual(['Tên môn', 'Số tín chỉ']);
    expect([sheet.getCell('I6').value, sheet.getCell('J6').value, sheet.getCell('K6').value]).toEqual(['{ten_mon}', '{so_tin_chi}', '{tong_so_tin_chi}']);

    const check = await checkXlsxTemplate(starter, sections);
    expect(check.unknown).toEqual([]);
    expect(check.error).toBe('');

    // Xuất: đơn có 2 môn chiếm 2 hàng, đơn không có môn chiếm 1 hàng
    const forms = [
      { ma_don: 'A-1', mon: [{ stt: 1, ten_mon: 'Triết', so_tin_chi: 3 }, { stt: 2, ten_mon: 'Luật', so_tin_chi: 2 }], tong_so_tin_chi: 5 },
      { ma_don: 'A-2', mon: [], tong_so_tin_chi: 0 },
    ];
    const filled = await readSheet(await renderXlsxTemplate(starter, forms, { so_don: 2, loai_don: 'X', ngay_xuat: '13/11/2026' }));
    expect(filled.getCell('A2').value).toBe('Ngày xuất: 13/11/2026 · Số đơn: 2');
    expect([filled.getCell('B6').value, filled.getCell('I6').value, filled.getCell('I7').value, filled.getCell('B8').value]).toEqual(['A-1', 'Triết', 'Luật', 'A-2']);
    expect(filled.model.merges).toEqual(expect.arrayContaining(['B6:B7', 'K6:K7']));
  });
});

describe('checkXlsxTemplate', () => {
  test('mã cột của bảng và {stt_dong} dùng được; mã lạ thì báo; báo ô thiếu ngoặc', async () => {
    const check = await checkXlsxTemplate(await makeTemplate(['{stt_dong}', '{ten_mon}', '{ma_la}', '{ly_do']), sections);
    expect(check.unknown).toEqual(['ma_la']);
    expect(check.found).toContain('so_don');
    expect(check.error).toContain('D3');
  });

  test('file không phải .xlsx thì không đọc được', async () => {
    expect(await isReadableXlsx(new TextEncoder().encode('không phải excel'))).toBe(false);
  });
});
