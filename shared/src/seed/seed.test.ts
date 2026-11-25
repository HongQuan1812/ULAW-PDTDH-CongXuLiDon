import { describe, expect, test } from 'vitest';
import { FormTypeSchema } from '../api-contract';
import { SEED_ACCOUNTS } from './accounts';
import { assertSeedValid, findSeedProblems } from './validate';
import { seedFormTypes } from './form-types';
import { seedForms, type SeedFormEvent } from './forms';
import { STUDENT_DIRECTORY } from './students';
import { SCHOOL_FORM_TYPES_SEED } from './school-form-types';
import { PRODUCTION_EXCLUDED_FORM_TYPE_PREFIXES, PRODUCTION_FORM_TYPES_SEED } from './production-form-types';

describe('loại đơn bản thật', () => {
  test('bỏ đúng các mã đơn chưa đưa lên bản thật, mã nào cũng có trong loại đơn theo mẫu Word', () => {
    // Arrange
    const schoolPrefixes = SCHOOL_FORM_TYPES_SEED.map((formType) => formType.prefix);

    // Act
    const productionPrefixes = PRODUCTION_FORM_TYPES_SEED.map((formType) => formType.prefix);

    // Assert
    expect(PRODUCTION_EXCLUDED_FORM_TYPE_PREFIXES.filter((prefix) => !schoolPrefixes.includes(prefix))).toEqual([]);
    expect(productionPrefixes.filter((prefix) => PRODUCTION_EXCLUDED_FORM_TYPE_PREFIXES.includes(prefix))).toEqual([]);
    expect(productionPrefixes.length).toBe(schoolPrefixes.length - PRODUCTION_EXCLUDED_FORM_TYPE_PREFIXES.length);
  });
});

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

  /** Dòng lịch sử cuối cùng thỏa điều kiện (lib ES2022 của shared chưa có Array.findLast). */
  const lastEvent = (history: SeedFormEvent[], matches: (event: SeedFormEvent) => boolean) => [...history].reverse().find(matches);

  test('lịch sử khớp với đơn: bắt đầu bằng Nộp đơn, theo thứ tự thời gian, khớp các mốc và trạng thái hiện tại', () => {
    for (const form of seedForms()) {
      const { history } = form;
      const times = history.map((event) => event.at);
      const actorIds = history.flatMap((event) => [event.actorId, event.toStaffId]).filter((id) => id !== null);

      expect(history[0]).toMatchObject({ action: 'submit', at: form.submittedAt, actorId: form.ownerId, status: 'nop' });
      expect(times).toEqual([...times].sort());
      expect(history.at(-1)!.status).toBe(form.status);
      expect(actorIds.filter((id) => !(id in SEED_ACCOUNTS))).toEqual([]);
      if (form.receivedAt) expect(lastEvent(history, (event) => event.action === 'receive')!.at).toBe(form.receivedAt);
      if (form.decidedAt) expect(lastEvent(history, (event) => ['requestSupplement', 'approve', 'reject'].includes(event.action))!.at).toBe(form.decidedAt);
      if (form.handlerId !== form.receiverId) expect(lastEvent(history, (event) => event.action === 'transfer')).toMatchObject({ action: 'transfer', toStaffId: form.handlerId, at: form.handlerSince });
      expect(lastEvent(history, (event) => event.actorId === form.ownerId)!.at).toBe(form.updatedAt);
    }
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

  test('loại đơn nào cũng có ít nhất 3 đơn mẫu, id tệp mẫu không trùng', () => {
    // Arrange
    const forms = seedForms();

    // Act
    const formCountByType = new Map(seedFormTypes().map((formType) => [formType.id, forms.filter((form) => form.formTypeId === formType.id).length]));
    const fileIds = forms.flatMap((form) =>
      Object.values(form.answers).flatMap((answer) =>
        Array.isArray(answer) ? (answer as unknown[]).flatMap((item) => (typeof item === 'object' && item !== null && 'sizeBytes' in item && 'id' in item ? [String(item.id)] : [])) : [],
      ),
    );

    // Assert
    expect([...formCountByType].filter(([, count]) => count < 3)).toEqual([]);
    expect(new Set(fileIds).size).toBe(fileIds.length);
  });

  test('dữ liệu mẫu qua đủ bộ luật: loại đơn (trình soạn), câu trả lời, tệp, mã đơn', () => {
    expect(findSeedProblems()).toEqual([]);
  });

  test('assertSeedValid không ném lỗi khi dữ liệu mẫu hợp lệ', () => {
    expect(() => assertSeedValid()).not.toThrow();
  });
});
