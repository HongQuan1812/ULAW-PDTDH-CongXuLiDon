import { describe, expect, test } from 'vitest';
import { VALIDATION_MESSAGES } from '../validators';
import { UpdateProfileRequestSchema } from './profile';

/** Lấy câu báo lỗi của ô nhập `field` sau khi kiểm tra `input`; không lỗi thì undefined. */
function errorOf(input: unknown, field: string): string | undefined {
  const result = UpdateProfileRequestSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('UpdateProfileRequestSchema', () => {
  test('chấp nhận hồ sơ đầy đủ, hợp lệ', () => {
    const result = UpdateProfileRequestSchema.safeParse({
      name: 'Nguyễn Minh Anh',
      cccd: '079206001234',
      phone: '0901234567',
    });
    expect(result.success).toBe(true);
  });

  test('chấp nhận CCCD và số điện thoại để trống', () => {
    const result = UpdateProfileRequestSchema.safeParse({ name: 'Nguyễn Minh Anh', cccd: '', phone: '' });
    expect(result.success).toBe(true);
  });

  test('cắt khoảng trắng đầu và cuối của mọi ô', () => {
    const result = UpdateProfileRequestSchema.parse({
      name: '  Nguyễn Minh Anh ',
      cccd: ' 079206001234 ',
      phone: ' 0901234567 ',
    });
    expect(result).toEqual({ name: 'Nguyễn Minh Anh', cccd: '079206001234', phone: '0901234567' });
  });

  test('báo lỗi khi họ tên chỉ có một chữ', () => {
    expect(errorOf({ name: 'Anh', cccd: '', phone: '' }, 'name')).toBe(VALIDATION_MESSAGES.fullName);
  });

  test('báo lỗi khi CCCD nhập sai định dạng', () => {
    expect(errorOf({ name: 'Nguyễn Minh Anh', cccd: '12345', phone: '' }, 'cccd')).toBe(VALIDATION_MESSAGES.cccd);
  });

  test('báo lỗi khi số điện thoại nhập sai định dạng', () => {
    expect(errorOf({ name: 'Nguyễn Minh Anh', cccd: '', phone: '0201234567' }, 'phone')).toBe(VALIDATION_MESSAGES.phone);
  });

  test('báo lỗi khi thiếu ô', () => {
    expect(UpdateProfileRequestSchema.safeParse({ name: 'Nguyễn Minh Anh' }).success).toBe(false);
  });
});
