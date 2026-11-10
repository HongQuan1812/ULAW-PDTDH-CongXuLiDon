import { describe, expect, it } from 'vitest';
import { findMatch, normalizeText } from './search';

describe('normalizeText', () => {
  it('bỏ dấu, đ → d, chữ thường, giữ nguyên số ký tự', () => {
    expect(normalizeText('Đã nộp')).toBe('da nop');
    expect(normalizeText('Cần bổ sung')).toHaveLength('Cần bổ sung'.length);
  });
});

describe('findMatch', () => {
  it('cắt đúng phần khớp trên chữ gốc', () => {
    expect(findMatch('Đơn Đã nộp', 'da nop')).toEqual({ before: 'Đơn ', match: 'Đã nộp', after: '' });
  });

  it('từ khóa trống hoặc không khớp thì null', () => {
    expect(findMatch('Đã duyệt', '  ')).toBeNull();
    expect(findMatch('Đã duyệt', 'từ chối')).toBeNull();
  });
});
