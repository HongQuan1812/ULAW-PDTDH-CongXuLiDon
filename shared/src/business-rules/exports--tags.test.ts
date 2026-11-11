import { describe, expect, test } from 'vitest';
import { FormSectionSchema } from '../aux-schema/form-types--sections';
import { buildExportData, columnTagOwners, knownExportTags, sampleExportData, textToTag, type ExportSource } from './exports--tags';

/** Loại đơn thử: một câu ngày, một câu chọn nhiều, một câu tải tệp, một bảng có cột tính tổng. */
const sections = [
  FormSectionSchema.parse({
    id: 's1',
    title: 'A',
    questions: [
      { id: 'i1', type: 'info', label: 'Lưu ý' },
      { id: 'q1', type: 'date', label: 'Ngày bắt đầu' },
      { id: 'q2', type: 'check', label: 'Học kỳ', options: ['HK1', 'HK2'] },
      { id: 'q3', type: 'file', label: 'Tệp bảng điểm', accept: ['pdf'], maxMB: 10 },
      {
        id: 'q4',
        type: 'table',
        label: 'Môn',
        tag: 'mon',
        rowName: 'môn',
        columns: [
          { label: 'Môn học của trường', type: 'text' },
          { label: 'Số tín chỉ', type: 'number', sum: true },
        ],
      },
    ],
  }),
];

describe('textToTag', () => {
  test('bỏ dấu, chữ thường, nối bằng gạch dưới', () => {
    expect(textToTag('Tệp bảng điểm')).toBe('tep_bang_diem');
    expect(textToTag('Đơn vị (cũ)')).toBe('don_vi_cu');
  });
  test('bắt đầu bằng số thì thêm _; không còn chữ thì "truong"', () => {
    expect(textToTag('2 môn')).toBe('_2_mon');
    expect(textToTag('???')).toBe('truong');
  });
});

describe('knownExportTags, columnTagOwners', () => {
  test('gồm mã chung, mã câu hỏi, mã bảng (stt, cột, so_, tong_); bỏ khối thông báo', () => {
    const known = knownExportTags(sections);
    for (const tag of ['ho_ten', 'ngay_bat_dau', 'hoc_ky', 'tep_bang_diem', 'mon', 'stt', 'mon_hoc_cua_truong', 'so_mon', 'tong_so_tin_chi']) {
      expect(known.has(tag)).toBe(true);
    }
    expect(known.has('luu_y')).toBe(false);
    expect(columnTagOwners(sections).get('so_tin_chi')).toEqual(['mon']);
  });
});

describe('buildExportData', () => {
  const source: ExportSource = {
    code: 'XMM-2026-001-00001',
    formTypeName: 'Xét miễn môn',
    submittedAt: '2026-10-30T07:05',
    status: 'duyet',
    receiverName: 'Phạm Thu Hà',
    handlerName: null,
    decidedAt: '2026-11-02T09:00',
    note: '',
    applicant: { name: 'Nguyễn Văn A', email: 'a@hcmulaw.edu.vn', phone: '0901234567', cccd: '079206001234' },
    mainStudent: { studentId: '2253801010001', className: null, trainingMode: 'Chính quy', major: 'Luật', currentCohort: 'K47', originalCohort: 'K47' },
    sections,
    answers: {
      q1: '2026-09-05',
      q2: ['HK1', 'HK2'],
      q3: [{ id: 'f1', name: 'bang-diem.pdf', sizeBytes: 10 }],
      q4: [
        ['Triết học', 3],
        ['Kinh tế', null],
      ],
    },
  };

  test('điền mã chung từ người nộp đơn, MSSV chính và thông tin đơn', () => {
    const exportData = buildExportData(source, '2026-11-11');
    expect(exportData).toMatchObject({
      ho_ten: 'Nguyễn Văn A',
      mssv: '2253801010001',
      lop: '',
      sdt: '0901 234 567',
      ngay_nop: '30/10/2026',
      gio_nop: '07:05',
      ngay: '30',
      thang: '10',
      nam: '2026',
      trang_thai: 'Đã duyệt',
      nguoi_tiep_nhan: 'Phạm Thu Hà',
      nguoi_xu_li: '',
      ngay_xu_li: '02/11/2026',
      ngay_xuat: '11/11/2026',
    });
  });

  test('ngày → dd/mm/yyyy, chọn nhiều nối dấu phẩy, tệp → tên tệp, bảng → các dòng kèm stt, số dòng, tổng cột', () => {
    const exportData = buildExportData(source, '2026-11-11');
    expect(exportData.ngay_bat_dau).toBe('05/09/2026');
    expect(exportData.hoc_ky).toBe('HK1, HK2');
    expect(exportData.tep_bang_diem).toBe('bang-diem.pdf');
    expect(exportData.mon).toEqual([
      { stt: 1, mon_hoc_cua_truong: 'Triết học', so_tin_chi: 3 },
      { stt: 2, mon_hoc_cua_truong: 'Kinh tế', so_tin_chi: '' },
    ]);
    expect(exportData.so_mon).toBe(2);
    expect(exportData.tong_so_tin_chi).toBe(3);
  });

  test('không có MSSV thì các mã sinh viên để trống', () => {
    expect(buildExportData({ ...source, mainStudent: null }, '2026-11-11')).toMatchObject({ mssv: '', nganh: '' });
  });
});

describe('sampleExportData', () => {
  test('câu hỏi điền "(nội dung câu hỏi)", bảng có 2 dòng', () => {
    const exportData = sampleExportData({ name: 'Xét miễn môn', prefix: 'XMM', sections }, '2026-11-11');
    expect(exportData.hoc_ky).toBe('(Học kỳ)');
    expect(exportData.so_mon).toBe(2);
    expect(exportData.mon).toHaveLength(2);
  });
});
