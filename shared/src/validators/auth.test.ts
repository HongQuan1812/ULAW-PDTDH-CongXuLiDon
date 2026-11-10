import { describe, expect, test } from 'vitest';
import { isSchoolEmail } from './auth';

describe('isSchoolEmail', () => {
  test('chấp nhận tên miền trường và tên miền con', () => {
    expect(isSchoolEmail('an@hcmulaw.edu.vn')).toBe(true);
    expect(isSchoolEmail('an@student.hcmulaw.edu.vn')).toBe(true);
  });

  test('từ chối email ngoài trường, kể cả tên miền giả dạng đuôi', () => {
    expect(isSchoolEmail('an@gmail.com')).toBe(false);
    expect(isSchoolEmail('an@evilhcmulaw.edu.vn')).toBe(false);
  });
});
