import { describe, expect, test } from 'vitest';
import { VALIDATION_MESSAGES } from '../validators';
import { CreateAccountRequestSchema, UpdateAccountRequestSchema, accountPath } from './accounts';

/** Một tài khoản mới hợp lệ, để từng test sửa một ô. */
const VALID_NEW_ACCOUNT = { name: 'Trần Quốc Việt', email: 'quocviet.tran.pdt@hcmulaw.edu.vn', role: 'nguoiXuLiDon', cccd: '', phone: '' };

/** Lấy câu báo lỗi của ô `field` khi tạo tài khoản với `input`; không lỗi thì undefined. */
function createErrorOf(input: unknown, field: string): string | undefined {
  const result = CreateAccountRequestSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('CreateAccountRequestSchema', () => {
  test('chấp nhận tài khoản mới hợp lệ, email đổi về chữ thường và bỏ khoảng trắng', () => {
    const result = CreateAccountRequestSchema.safeParse({ ...VALID_NEW_ACCOUNT, email: '  QuocViet.Tran.PDT@HCMULAW.edu.vn ' });
    expect(result.success && result.data.email).toBe('quocviet.tran.pdt@hcmulaw.edu.vn');
  });

  test('email sai định dạng hoặc không phải email trường thì báo lỗi', () => {
    expect(createErrorOf({ ...VALID_NEW_ACCOUNT, email: 'khong-phai-email' }, 'email')).toBe(VALIDATION_MESSAGES.email);
    expect(createErrorOf({ ...VALID_NEW_ACCOUNT, email: 'viet@gmail.com' }, 'email')).toBe(VALIDATION_MESSAGES.schoolEmail);
  });

  test('họ tên một chữ, vai trò lạ, CCCD và SĐT sai định dạng thì báo lỗi', () => {
    expect(createErrorOf({ ...VALID_NEW_ACCOUNT, name: 'Việt' }, 'name')).toBe(VALIDATION_MESSAGES.fullName);
    expect(createErrorOf({ ...VALID_NEW_ACCOUNT, role: 'sieuNhan' }, 'role')).toBeDefined();
    expect(createErrorOf({ ...VALID_NEW_ACCOUNT, cccd: '12345' }, 'cccd')).toBe(VALIDATION_MESSAGES.cccd);
    expect(createErrorOf({ ...VALID_NEW_ACCOUNT, phone: '0123' }, 'phone')).toBe(VALIDATION_MESSAGES.phone);
  });
});

describe('UpdateAccountRequestSchema', () => {
  test('không nhận email: email gửi kèm bị bỏ qua', () => {
    const result = UpdateAccountRequestSchema.safeParse({ ...VALID_NEW_ACCOUNT, email: 'moi@hcmulaw.edu.vn' });
    expect(result.success && 'email' in result.data).toBe(false);
  });
});

test('accountPath ghép id vào đường dẫn', () => {
  expect(accountPath('sv-2')).toBe('/accounts/sv-2');
});
