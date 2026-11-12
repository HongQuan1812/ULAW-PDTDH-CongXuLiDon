import { describe, expect, test } from 'vitest';
import { FormTypeSchema } from '../api-contract';
import { SEED_ACCOUNTS } from './accounts';
import { seedFormTypes } from './form-types';
import { seedForms } from './forms';
import { STUDENT_DIRECTORY } from './students';

describe('dữ liệu mẫu', () => {
  test('mọi đơn có người nộp và cán bộ nằm trong tài khoản mẫu', () => {
    // Arrange
    const forms = seedForms();

    // Act
    const unknownUserIds = forms.flatMap((form) => [form.ownerId, form.receiverId, form.handlerId]).filter((id) => id !== null && !(id in SEED_ACCOUNTS));

    // Assert
    expect(forms.length).toBeGreaterThan(0);
    expect(unknownUserIds).toEqual([]);
  });

  test('mã đơn không trùng nhau', () => {
    const codes = seedForms().map((form) => form.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  test('đơn mẫu thuộc một loại đơn có thật, bản chụp loại đơn hợp lệ', () => {
    const formTypeIds = new Set(seedFormTypes().map((formType) => formType.id));

    for (const form of seedForms()) {
      expect(formTypeIds.has(form.formTypeId)).toBe(true);
      expect(FormTypeSchema.safeParse(form.formTypeSnapshot).success).toBe(true);
    }
  });

  test('MSSV của sinh viên không trùng nhau và thuộc tài khoản có thật', () => {
    const studentIds = Object.values(STUDENT_DIRECTORY).flatMap((students) => students.map((student) => student.studentId));

    expect(new Set(studentIds).size).toBe(studentIds.length);
    expect(Object.keys(STUDENT_DIRECTORY).filter((id) => !(id in SEED_ACCOUNTS))).toEqual([]);
  });
});
