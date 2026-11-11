import { describe, expect, it } from 'vitest';
import { formatFormCode, nextFormCode } from './forms--codes';

describe('mã đơn', () => {
  it('ghép năm, phiên bản 3 chữ số, số thứ tự 5 chữ số', () => {
    expect(formatFormCode('XMM', 2026, 1, 1)).toBe('XMM-2026-001-00001');
    expect(formatFormCode('XMM', 2026, 12, 345)).toBe('XMM-2026-012-00345');
  });

  it('đếm tiếp qua các phiên bản: lấy số lớn nhất của cùng tiền tố và năm rồi cộng 1', () => {
    const codes = ['XMM-2026-001-01520', 'XMM-2026-002-00003', 'XMM-2025-001-09999', 'THU-2026-001-00042'];
    expect(nextFormCode('XMM', 2026, 2, codes)).toBe('XMM-2026-002-01521');
    expect(nextFormCode('THU', 2026, 3, codes)).toBe('THU-2026-003-00043');
  });

  it('năm mới hoặc tiền tố mới thì bắt đầu từ 1', () => {
    expect(nextFormCode('XMM', 2027, 2, ['XMM-2026-001-01520'])).toBe('XMM-2027-002-00001');
    expect(nextFormCode('ABC', 2026, 1, [])).toBe('ABC-2026-001-00001');
  });
});
