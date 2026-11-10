import { beforeEach, describe, expect, test } from 'vitest';
import {
  getFormsOf,
  getProfile,
  getStudents,
  isCccdTaken,
  resetMockDb,
  saveMainStudent,
  saveProfile,
  toSession,
} from './db';

beforeEach(() => {
  resetMockDb();
});

describe('hồ sơ ban đầu', () => {
  test('sinh viên mẫu chưa bổ sung thông tin lần đầu, chưa có CCCD và SĐT', () => {
    const profile = getProfile('sv-1');
    expect(profile.completed).toBe(false);
    expect(profile.cccd).toBeNull();
    expect(profile.phone).toBeNull();
  });

  test('cán bộ mẫu đã bổ sung thông tin', () => {
    expect(getProfile('cb-1').completed).toBe(true);
  });
});

describe('saveProfile', () => {
  test('lưu họ tên, CCCD, SĐT và đánh dấu đã bổ sung thông tin', () => {
    const saved = saveProfile('sv-1', { name: 'Nguyễn Minh Anh', cccd: '079206001234', phone: '0901234567' });
    expect(saved).toEqual({
      name: 'Nguyễn Minh Anh',
      cccd: '079206001234',
      phone: '0901234567',
      completed: true,
      mainStudentId: null,
    });
    expect(getProfile('sv-1')).toEqual(saved);
  });

  test('chuỗi rỗng nghĩa là xóa CCCD và SĐT (lưu null)', () => {
    saveProfile('sv-1', { name: 'Nguyễn Minh Anh', cccd: '079206001234', phone: '0901234567' });
    const saved = saveProfile('sv-1', { name: 'Nguyễn Minh Anh', cccd: '', phone: '' });
    expect(saved.cccd).toBeNull();
    expect(saved.phone).toBeNull();
  });
});

describe('MSSV', () => {
  test('sinh viên mẫu có 2 MSSV, cán bộ không có MSSV nào', () => {
    expect(getStudents('sv-1')).toHaveLength(2);
    expect(getStudents('cb-1')).toEqual([]);
  });

  test('lưu MSSV chính, và lưu hồ sơ sau đó không làm mất MSSV chính', () => {
    saveMainStudent('sv-1', '2523801040017');
    expect(getProfile('sv-1').mainStudentId).toBe('2523801040017');
    saveProfile('sv-1', { name: 'Nguyễn Minh Anh', cccd: '', phone: '' });
    expect(getProfile('sv-1').mainStudentId).toBe('2523801040017');
  });
});

describe('isCccdTaken', () => {
  test('true khi CCCD thuộc tài khoản khác', () => {
    const cccdOfStaff = getProfile('cb-1').cccd as string;
    expect(isCccdTaken(cccdOfStaff, 'sv-1')).toBe(true);
  });

  test('false khi CCCD là của chính mình hoặc chưa ai dùng', () => {
    const cccdOfStaff = getProfile('cb-1').cccd as string;
    expect(isCccdTaken(cccdOfStaff, 'cb-1')).toBe(false);
    expect(isCccdTaken('079200009999', 'sv-1')).toBe(false);
  });
});

describe('toSession', () => {
  test('phản ánh họ tên mới và trạng thái đã bổ sung thông tin', () => {
    expect(toSession('nguoiNopDon').profileCompleted).toBe(false);
    saveProfile('sv-1', { name: 'Nguyễn Minh Anh Thư', cccd: '', phone: '' });
    const session = toSession('nguoiNopDon');
    expect(session.profileCompleted).toBe(true);
    expect(session.user.name).toBe('Nguyễn Minh Anh Thư');
  });
});

describe('đơn đã nộp', () => {
  test('sinh viên mẫu có 18 đơn đủ các trạng thái, mã đơn không trùng; cán bộ chưa có đơn', () => {
    const forms = getFormsOf('sv-1');
    expect(forms).toHaveLength(18);
    expect(new Set(forms.map((form) => form.code)).size).toBe(18);
    expect(new Set(forms.map((form) => form.status))).toEqual(new Set(['nop', 'xet', 'bs', 'bsg', 'duyet', 'tc']));
    expect(forms[0]).toMatchObject({ code: 'XMM-2026-01520', submittedAt: '2026-10-30T07:00', status: 'nop' });
    expect(getFormsOf('cb-1')).toEqual([]);
  });
});
