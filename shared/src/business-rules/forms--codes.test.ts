import { describe, expect, it } from 'vitest';
import { formatFormCode, nextFormCode } from './forms--codes';

describe('mã đơn', () => {
  it('ghép đủ 5 chữ số', () => {
    expect(formatFormCode('XMM', 2026, 1)).toBe('XMM-2026-00001');
  });

  it('lấy số lớn nhất của cùng tiền tố và năm rồi cộng 1', () => {
    const codes = ['XMM-2026-01520', 'XMM-2026-00003', 'XMM-2025-09999', 'THU-2026-00042'];
    expect(nextFormCode('XMM', 2026, codes)).toBe('XMM-2026-01521');
    expect(nextFormCode('THU', 2026, codes)).toBe('THU-2026-00043');
  });

  it('năm mới hoặc tiền tố mới thì bắt đầu từ 1', () => {
    expect(nextFormCode('XMM', 2027, ['XMM-2026-01520'])).toBe('XMM-2027-00001');
    expect(nextFormCode('ABC', 2026, [])).toBe('ABC-2026-00001');
  });
});
