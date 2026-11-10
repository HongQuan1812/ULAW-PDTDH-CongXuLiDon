import { describe, expect, it } from 'vitest';
import { canEditForm, canReceiveForm } from './accounts--permissions';

describe('canEditForm', () => {
  const student = { id: 'sv-1', role: 'nguoiNopDon' } as const;
  const staff = { id: 'cb-1', role: 'nguoiXuLiDon' } as const;
  const admin = { id: 'cb-3', role: 'admin' } as const;

  it('người nộp sửa được đơn của mình khi Đã nộp / Cần bổ sung / Đã bổ sung', () => {
    expect(canEditForm(student, { status: 'nop', applicantId: 'sv-1' })).toBe(true);
    expect(canEditForm(student, { status: 'bs', applicantId: 'sv-1' })).toBe(true);
    expect(canEditForm(student, { status: 'bsg', applicantId: 'sv-1' })).toBe(true);
  });

  it('đơn đã tiếp nhận hoặc có kết quả thì không ai sửa được', () => {
    expect(canEditForm(student, { status: 'xet', applicantId: 'sv-1' })).toBe(false);
    expect(canEditForm(admin, { status: 'duyet', applicantId: 'sv-1' })).toBe(false);
  });

  it('đơn người khác: chỉ Admin (editAnyForm) sửa được; chưa đăng nhập thì không', () => {
    expect(canEditForm(staff, { status: 'nop', applicantId: 'sv-1' })).toBe(false);
    expect(canEditForm(admin, { status: 'nop', applicantId: 'sv-1' })).toBe(true);
    expect(canEditForm(null, { status: 'nop', applicantId: 'sv-1' })).toBe(false);
  });
});

describe('canReceiveForm', () => {
  it('cán bộ có quyền receive tiếp nhận được đơn Đã nộp / Đã bổ sung', () => {
    expect(canReceiveForm('nguoiXuLiDon', 'nop')).toBe(true);
    expect(canReceiveForm('admin', 'bsg')).toBe(true);
  });

  it('đơn đã tiếp nhận, Cần bổ sung hoặc đã có kết quả thì không tiếp nhận được', () => {
    (['xet', 'bs', 'duyet', 'tc'] as const).forEach((status) => expect(canReceiveForm('admin', status)).toBe(false));
  });

  it('người nộp đơn và người chưa đăng nhập không tiếp nhận được', () => {
    expect(canReceiveForm('nguoiNopDon', 'nop')).toBe(false);
    expect(canReceiveForm(null, 'nop')).toBe(false);
  });
});
