import { describe, expect, it } from 'vitest';
import { isIsoDate, maskDateInput, parseDisplayDate } from './format';

describe('maskDateInput', () => {
  it('chèn "/" sau ngày và tháng khi đã gõ sang phần sau', () => {
    expect(maskDateInput('12')).toBe('12');
    expect(maskDateInput('123')).toBe('12/3');
    expect(maskDateInput('12032026')).toBe('12/03/2026');
    expect(maskDateInput('12/03/20269')).toBe('12/03/2026');
  });
  it('bỏ chữ không phải số', () => {
    expect(maskDateInput('1a2-0')).toBe('12/0');
  });
});

describe('parseDisplayDate', () => {
  it('đọc ngày/tháng/năm thành YYYY-MM-DD', () => {
    expect(parseDisplayDate('30/10/2026')).toBe('2026-10-30');
    expect(parseDisplayDate('29/02/2028')).toBe('2028-02-29');
  });
  it('không đọc ngày chưa đủ hoặc không có thật', () => {
    expect(parseDisplayDate('30/10/26')).toBeNull();
    expect(parseDisplayDate('31/02/2026')).toBeNull();
    expect(parseDisplayDate('29/02/2026')).toBeNull();
    expect(parseDisplayDate('00/10/2026')).toBeNull();
  });
});

describe('isIsoDate', () => {
  it('nhận ngày YYYY-MM-DD có thật', () => {
    expect(isIsoDate('2026-10-30')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('30/10/2026')).toBe(false);
  });
});
