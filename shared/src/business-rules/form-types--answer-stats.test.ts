import { describe, expect, test } from 'vitest';
import { DEFAULT_FORM_TYPE_STATS_QUERY, formTypeStatsQueryParams, parseFormTypeStatsQueryParams } from '../api-contract/form-types';
import type { FormSection } from '../aux-schema/form-types--sections';
import { computeFormTypeAnswerStats, dateBins, numberBins, type StatsFormSource } from './form-types--answer-stats';

const labelsOf = (bins: { label: string }[]) => bins.map((bin) => bin.label);
const countsOf = (bins: { count: number }[]) => bins.map((bin) => bin.count);

describe('numberBins', () => {
  test('không quá 10 giá trị khác nhau: mỗi giá trị một cột, không chen giá trị thiếu, kể cả số lẻ', () => {
    const bins = numberBins([2, 3, 2, 4, 1, 2, 3]);
    expect(labelsOf(bins)).toEqual(['1', '2', '3', '4']);
    expect(countsOf(bins)).toEqual([1, 3, 2, 1]);
    expect(labelsOf(numberBins([1, 4]))).toEqual(['1', '4']);
    expect(numberBins([3.25, 2.9, 3.25])).toEqual([{ label: '2,9', count: 1 }, { label: '3,25', count: 2 }]);
  });

  test('nhiều giá trị nguyên: chia đều, độ rộng tròn, mốc đầu là bội của độ rộng', () => {
    // 2 tới 18: độ rộng 2 cần 9 nhóm (quá 8) nên lấy 5, bắt đầu từ 0
    const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18];
    const bins = numberBins(values);
    expect(labelsOf(bins)).toEqual(['0–4', '5–9', '10–14', '15–19']);
    expect(countsOf(bins)).toEqual([3, 5, 3, 1]);
  });

  test('nhiều số lẻ: nhóm ghi mốc đầu và mốc sau, kể cả nhóm 0 ở giữa', () => {
    const bins = numberBins([5, 5.5, 6.5, 7.1, 7.2, 7.3, 7.4, 7.6, 7.8, 9.5, 9.8]);
    expect(labelsOf(bins)).toEqual(['5–6', '6–7', '7–8', '8–9', '9–10']);
    expect(countsOf(bins)).toEqual([2, 1, 6, 0, 2]);
  });

  test('không quá 8 nhóm, số lớn ghi kiểu Việt Nam', () => {
    const bins = numberBins([0, 1_234_567, 9_999_999, 3_000_000.5, 1, 2, 3, 4, 5, 6, 7]);
    expect(bins.length).toBeLessThanOrEqual(8);
    expect(bins[0]!.label).toBe('0–2.000.000');
  });

  test('một giá trị lẻ duy nhất, không có câu trả lời', () => {
    expect(numberBins([7.5, 7.5])).toEqual([{ label: '7,5', count: 2 }]);
    expect(numberBins([])).toEqual([]);
  });
});

describe('dateBins', () => {
  test('dưới 2 tuần: theo ngày, kể cả ngày 0', () => {
    const bins = dateBins(['2026-11-05', '2026-11-03', '2026-11-05']);
    expect(labelsOf(bins)).toEqual(['03/11', '04/11', '05/11']);
    expect(countsOf(bins)).toEqual([1, 0, 2]);
  });

  test('dưới 2 tháng: theo tuần lịch, cột ghi thứ Hai đầu tuần', () => {
    // 04/08/2026 là thứ Ba → thuộc tuần bắt đầu thứ Hai 03/08
    const bins = dateBins(['2026-08-04', '2026-08-10', '2026-08-11', '2026-08-17', '2026-09-20']);
    expect(labelsOf(bins)).toEqual(['03/08', '10/08', '17/08', '24/08', '31/08', '07/09', '14/09']);
    expect(countsOf(bins)).toEqual([1, 2, 1, 0, 0, 0, 1]);
  });

  test('dưới 2 năm: theo tháng (T6/26)', () => {
    expect(labelsOf(dateBins(['2026-06-14', '2026-09-01']))).toEqual(['T6/26', 'T7/26', 'T8/26', 'T9/26']);
  });

  test('từ 2 năm: theo năm, không có nhóm "Trước…"', () => {
    const bins = dateBins(['2023-06-14', '2026-11-05', '2026-01-01']);
    expect(labelsOf(bins)).toEqual(['2023', '2024', '2025', '2026']);
    expect(countsOf(bins)).toEqual([1, 0, 0, 2]);
  });

  test('ranh giới: đúng 2 tuần đã sang theo tuần, đúng 2 tháng đã sang theo tháng', () => {
    expect(dateBins(['2026-11-01', '2026-11-14']).length).toBe(14);
    expect(labelsOf(dateBins(['2026-11-01', '2026-11-15']))[0]).toBe('26/10');
    expect(labelsOf(dateBins(['2026-01-31', '2026-03-31']))).toEqual(['T1/26', 'T2/26', 'T3/26']);
  });
});

describe('tham số thống kê trên đường dẫn', () => {
  test('ghi rồi đọc lại ra đúng điều kiện', () => {
    const query = { version: 2, submittedFrom: '2026-09-01', submittedTo: null, statuses: ['nop', 'xet'] } as const;
    const params = formTypeStatsQueryParams({ ...query, statuses: [...query.statuses] });
    expect(params).toEqual({ version: '2', submittedFrom: '2026-09-01', statuses: 'nop,xet' });
    expect(parseFormTypeStatsQueryParams(params)).toEqual({ ...query, statuses: ['nop', 'xet'] });
  });

  test('không gửi gì là mặc định; sai dạng thì null', () => {
    expect(parseFormTypeStatsQueryParams({})).toEqual(DEFAULT_FORM_TYPE_STATS_QUERY);
    expect(parseFormTypeStatsQueryParams({ version: 'abc' })).toBeNull();
    expect(parseFormTypeStatsQueryParams({ statuses: 'nop,khong-co' })).toBeNull();
    expect(parseFormTypeStatsQueryParams({ submittedFrom: '2026-12-01', submittedTo: '2026-11-01' })).toBeNull();
  });
});

/* ---------- Loại đơn thử: phiên bản 1 có câu "Mã học phần cũ", phiên bản 2 bỏ câu đó, thêm cột "Ngày học" ---------- */

const version1Sections: FormSection[] = [
  {
    id: 's1',
    title: 'Thông tin',
    main: false,
    questions: [
      { id: 'hk', type: 'radio', label: 'Học kỳ', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
      { id: 'ma', type: 'text', label: 'Mã học phần cũ', required: false },
      {
        id: 'bang',
        type: 'table',
        label: 'Các học phần',
        required: true,
        rowName: 'môn',
        columns: [
          { label: 'Tên', type: 'text' },
          { label: 'Tín chỉ', type: 'number' },
        ],
      },
    ],
  },
];

const version2Sections: FormSection[] = [
  {
    id: 's1',
    title: 'Thông tin đề nghị',
    main: false,
    questions: [
      { id: 'hk', type: 'radio', label: 'Học kỳ đề nghị', required: true, options: ['Học kỳ 1', 'Học kỳ 2'] },
      { id: 'gt', type: 'info', content: { type: 'doc', content: [{ type: 'paragraph' }] } },
      {
        id: 'bang',
        type: 'table',
        label: 'Các học phần',
        required: true,
        rowName: 'môn',
        columns: [
          { label: 'Tên', type: 'text' },
          { label: 'Ngày học', type: 'date' },
          { label: 'Tín chỉ', type: 'number' },
        ],
      },
    ],
  },
  { id: 's2', title: 'Lí do', main: false, questions: [{ id: 'li', type: 'para', label: 'Lí do', required: true }] },
];

const versions = [
  { version: 1, sections: version1Sections },
  { version: 2, sections: version2Sections },
];

const forms: StatsFormSource[] = [
  { code: 'A', version: 1, status: 'duyet', submittedAt: '2026-09-01T08:00', answers: { hk: 'Học kỳ 1', ma: 'PHI1006', bang: [['Triết', 3]] } },
  { code: 'B', version: 1, status: 'tc', submittedAt: '2026-09-02T08:00', answers: { hk: 'Học kỳ 2', ma: ' phi1006 ', bang: [] } },
  {
    code: 'C',
    version: 2,
    status: 'nop',
    submittedAt: '2026-11-20T09:00',
    answers: { hk: 'Học kỳ 1', bang: [['Triết', '2026-01-10', 2], ['Kinh tế', null, 3]], li: 'Em đã học rồi.' },
  },
  { code: 'D', version: 2, status: 'nop', submittedAt: '2026-11-21T09:00', answers: { hk: '', bang: [], li: '' } },
];

describe('computeFormTypeAnswerStats', () => {
  test('mọi phiên bản: gộp phần, câu theo phiên bản mới nhất, câu chỉ có ở phiên bản cũ chen đúng chỗ, bỏ khối thông báo', () => {
    const stats = computeFormTypeAnswerStats(versions, forms, DEFAULT_FORM_TYPE_STATS_QUERY)!;
    expect(stats.total).toBe(4);
    expect(stats.sections.map((section) => section.title)).toEqual(['Thông tin đề nghị', 'Lí do']);
    expect(stats.sections[0]!.questions.map((question) => question.id)).toEqual(['hk', 'ma', 'bang']);

    const oldOnly = stats.sections[0]!.questions[1]!;
    expect(oldOnly.onlyInVersions).toEqual([1]);
    expect(oldOnly.formCount).toBe(2);
    expect(oldOnly.stats).toEqual({ kind: 'text', distinctCount: 1, answers: [{ text: 'PHI1006', count: 2 }] });
    expect(stats.sections[0]!.questions[0]!.onlyInVersions).toBeNull();
  });

  test('Chọn một: đếm theo lựa chọn, câu bỏ trống không tính là đã trả lời', () => {
    const semester = computeFormTypeAnswerStats(versions, forms, DEFAULT_FORM_TYPE_STATS_QUERY)!.sections[0]!.questions[0]!;
    expect(semester.label).toBe('Học kỳ đề nghị');
    expect(semester.answered).toBe(3);
    expect(semester.formCount).toBe(4);
    expect(semester.stats).toEqual({ kind: 'options', options: [{ label: 'Học kỳ 1', count: 2 }, { label: 'Học kỳ 2', count: 1 }] });
  });

  test('Bảng: gộp cột theo tên, đọc ô theo cột của phiên bản mỗi đơn', () => {
    const table = computeFormTypeAnswerStats(versions, forms, DEFAULT_FORM_TYPE_STATS_QUERY)!.sections[0]!.questions[2]!;
    expect(table.answered).toBe(2);
    if (table.stats.kind !== 'table') throw new Error('phải là bảng');
    expect(table.stats.rowCount).toBe(3);
    expect(table.stats.columns.map((column) => column.label)).toEqual(['Tên', 'Ngày học', 'Tín chỉ']);
    expect(table.stats.columns[0]!.stats).toEqual({ kind: 'text', distinctCount: 2, answers: [{ text: 'Triết', count: 2 }, { text: 'Kinh tế', count: 1 }] });
    expect(table.stats.columns[1]!.answered).toBe(1);
    expect(table.stats.columns[2]!.stats).toMatchObject({ kind: 'number', min: 2, max: 3, average: 8 / 3 });
  });

  test('lọc phiên bản, ngày nộp, trạng thái; số trên nút trạng thái chưa lọc trạng thái', () => {
    const stats = computeFormTypeAnswerStats(versions, forms, { version: 'all', submittedFrom: '2026-09-02', submittedTo: null, statuses: ['nop'] })!;
    expect(stats.total).toBe(2);
    expect(stats.byStatus).toEqual({ nop: 2, xet: 0, bs: 0, bsg: 0, duyet: 0, tc: 1 });

    const version2 = computeFormTypeAnswerStats(versions, forms, { ...DEFAULT_FORM_TYPE_STATS_QUERY, version: 2 })!;
    expect(version2.total).toBe(2);
    expect(version2.sections[0]!.questions.map((question) => question.id)).toEqual(['hk', 'bang']);
    expect(version2.sections[0]!.questions.every((question) => question.onlyInVersions === null)).toBe(true);
  });

  test('Đoạn văn: câu mới nhất trước, bỏ câu trống; phiên bản không có thì null', () => {
    const reason = computeFormTypeAnswerStats(versions, forms, DEFAULT_FORM_TYPE_STATS_QUERY)!.sections[1]!.questions[0]!;
    expect(reason.onlyInVersions).toEqual([2]);
    expect(reason.stats).toEqual({ kind: 'para', answers: [{ formCode: 'C', submittedAt: '2026-11-20T09:00', text: 'Em đã học rồi.' }] });
    expect(computeFormTypeAnswerStats(versions, forms, { ...DEFAULT_FORM_TYPE_STATS_QUERY, version: 9 })).toBeNull();
  });
});
