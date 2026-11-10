import { describe, expect, test } from 'vitest';
import { isFullName, isValidCccd, isValidPhone, maskCccd } from './profile';

describe('isFullName', () => {
  test('chấp nhận họ tên có từ 2 chữ trở lên', () => {
    expect(isFullName('Nguyễn Minh Anh')).toBe(true);
    expect(isFullName('  Lê Anh  ')).toBe(true);
  });

  test('từ chối tên trống hoặc chỉ một chữ', () => {
    expect(isFullName('')).toBe(false);
    expect(isFullName('   ')).toBe(false);
    expect(isFullName('Anh')).toBe(false);
  });
});

describe('isValidCccd', () => {
  test('chấp nhận đúng 12 số và bắt đầu bằng 0', () => {
    expect(isValidCccd('079206001234')).toBe(true);
  });

  test('từ chối sai độ dài, không bắt đầu bằng 0, hoặc có chữ', () => {
    expect(isValidCccd('07920600123')).toBe(false);
    expect(isValidCccd('0792060012345')).toBe(false);
    expect(isValidCccd('179206001234')).toBe(false);
    expect(isValidCccd('07920600123a')).toBe(false);
    expect(isValidCccd('')).toBe(false);
  });
});

describe('isValidPhone', () => {
  test('chấp nhận 10 số, bắt đầu bằng 03, 05, 07, 08, 09', () => {
    for (const phone of ['0301234567', '0501234567', '0701234567', '0801234567', '0901234567']) {
      expect(isValidPhone(phone)).toBe(true);
    }
  });

  test('từ chối đầu số khác, sai độ dài hoặc có chữ', () => {
    expect(isValidPhone('0201234567')).toBe(false);
    expect(isValidPhone('0401234567')).toBe(false);
    expect(isValidPhone('090123456')).toBe(false);
    expect(isValidPhone('09012345678')).toBe(false);
    expect(isValidPhone('09012345ab')).toBe(false);
  });
});

describe('maskCccd', () => {
  test('che phần giữa, giữ 3 số đầu và 4 số cuối', () => {
    expect(maskCccd('079206001234')).toBe('079•••••1234');
  });

  test('trả về null khi chưa có CCCD', () => {
    expect(maskCccd(null)).toBeNull();
    expect(maskCccd('')).toBeNull();
  });
});
