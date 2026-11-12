import { describe, expect, it } from 'vitest';
import { EMAIL_SAMPLE_VALUES, fillEmailTemplate, findEmailTags, splitEmailTemplate, type EmailTagValues } from './email--tags';

const values: EmailTagValues = { ...EMAIL_SAMPLE_VALUES, chu_ki: 'Phòng Đào tạo' };

describe('splitEmailTemplate', () => {
  it('tách chữ thường, mã đã thay và mã lạ theo đúng thứ tự', () => {
    expect(splitEmailTemplate('Chào {ho_ten}, mã {ma_so}.', values)).toEqual([
      { kind: 'text', text: 'Chào ' },
      { kind: 'filled', tag: 'ho_ten', text: 'Nguyễn Văn An' },
      { kind: 'text', text: ', mã ' },
      { kind: 'unknown', text: '{ma_so}' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('không có mã thì một đoạn chữ; chuỗi trống thì không có đoạn nào', () => {
    expect(splitEmailTemplate('Xin chào', values)).toEqual([{ kind: 'text', text: 'Xin chào' }]);
    expect(splitEmailTemplate('', values)).toEqual([]);
  });
});

describe('fillEmailTemplate', () => {
  it('thay mọi mã, kể cả mã lặp lại; mã lạ giữ nguyên', () => {
    expect(fillEmailTemplate('[{ma_don}] {ma_don} {la}\n{chu_ki}', values)).toBe('[XMM-2026-001-00001] XMM-2026-001-00001 {la}\nPhòng Đào tạo');
  });
});

describe('findEmailTags', () => {
  it('trả vị trí từng mã, đánh dấu mã lạ', () => {
    expect(findEmailTags('Chào {ho_ten}, mã {abc}')).toEqual([
      { start: 5, end: 13, known: true },
      { start: 18, end: 23, known: false },
    ]);
  });

  it('không có mã thì trả []', () => {
    expect(findEmailTags('Chào bạn {Ho Ten}')).toEqual([]);
  });
});
