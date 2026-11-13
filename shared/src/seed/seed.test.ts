import { describe, expect, test } from 'vitest';
import { FormTypeSchema } from '../api-contract';
import { SEED_ACCOUNTS } from './accounts';
import { assertSeedValid, findSeedProblems } from './validate';
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

  test('đơn thử nghiệm mẫu có đủ loại câu trả lời, bảng đủ 0 – 4 dòng, id tệp không trùng', () => {
    const testForms = seedForms().filter((form) => form.formTypeId === 'thu');
    const tableSizes = testForms.map((form) => (form.answers['mon-hoc'] as unknown[]).length);
    const fileIds = testForms.flatMap((form) => (form.answers['tep-dinh-kem'] as { id: string }[]).map((file) => file.id));

    expect(testForms.length).toBeGreaterThanOrEqual(5);
    expect(new Set(tableSizes)).toEqual(new Set([0, 1, 2, 4, 5]));
    expect(new Set(fileIds).size).toBe(fileIds.length);
  });

  test('dữ liệu mẫu qua đủ bộ luật: loại đơn (trình soạn), câu trả lời, tệp, mã đơn', () => {
    expect(findSeedProblems()).toEqual([]);
  });

  test('assertSeedValid không ném lỗi khi dữ liệu mẫu hợp lệ', () => {
    expect(() => assertSeedValid()).not.toThrow();
  });
});
