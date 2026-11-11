import { describe, expect, it } from 'vitest';
import { EMPTY_RICH_TEXT_DOC, FormSectionSchema, type QuestionOf } from '@ulaw/shared';
import { answersChanged, initialAnswers, sumColumn, tableTotalText } from './formAnswers';

/* Một phần có đủ các kiểu câu trả lời trống. */
const SECTION = FormSectionSchema.parse({
  id: 's',
  title: 'Phần thử',
  questions: [
    { id: 'thong-bao', type: 'info', content: EMPTY_RICH_TEXT_DOC },
    { id: 'ten', type: 'text', label: 'Tên' },
    { id: 'so', type: 'number', label: 'Số' },
    { id: 'chon', type: 'check', label: 'Chọn', options: ['A'] },
    { id: 'tep', type: 'file', label: 'Tệp', accept: ['pdf'], maxMB: 1 },
    {
      id: 'mon',
      type: 'table',
      label: 'Môn',
      required: true,
      rowName: 'môn',
      columns: [
        { label: 'Tên môn', type: 'text' },
        { label: 'Số tín chỉ', type: 'number', sum: true, sumLabel: 'tín chỉ' },
      ],
    },
    { id: 'bang-phu', type: 'table', label: 'Bảng phụ', rowName: 'dòng', columns: [{ label: 'Ghi chú', type: 'text' }] },
  ],
});
const TABLE = SECTION.questions[5] as QuestionOf<'table'>;

describe('initialAnswers', () => {
  it('mỗi câu một câu trả lời trống, bỏ khối thông báo; bảng chưa có dòng nào, kể cả bảng bắt buộc', () => {
    expect(initialAnswers([SECTION])).toEqual({
      ten: '',
      so: null,
      chon: [],
      tep: [],
      mon: [],
      'bang-phu': [],
    });
  });
});

describe('dòng tổng của bảng', () => {
  it('cộng cột số, ô trống tính là 0', () => {
    const rows = [
      ['Triết học', 3],
      ['Kinh tế chính trị', null],
      ['Luật Hiến pháp', 2],
    ];
    expect(sumColumn(rows, 1)).toBe(5);
    expect(tableTotalText(TABLE, rows)).toBe('3 môn · tổng 5 tín chỉ');
    expect(tableTotalText(TABLE, [])).toBe('0 môn · tổng 0 tín chỉ');
  });
});

describe('answersChanged', () => {
  const saved = { ten: 'An', so: 3, 'thong-bao-cu': 'giữ' };

  it('câu trả lời như đã lưu: không đổi; câu hỏi không còn trong loại đơn không tính', () => {
    expect(answersChanged([SECTION], saved, { ...saved })).toBe(false);
    expect(answersChanged([SECTION], saved, { ten: 'An', so: 3 })).toBe(false);
  });

  it('sửa một câu: có đổi', () => {
    expect(answersChanged([SECTION], saved, { ...saved, so: 4 })).toBe(true);
  });
});
