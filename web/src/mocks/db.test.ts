import { beforeEach, describe, expect, test } from 'vitest';
import { getProfile, isCccdTaken, resetMockDb, saveProfile, toSession } from './db';

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
    expect(saved).toEqual({ name: 'Nguyễn Minh Anh', cccd: '079206001234', phone: '0901234567', completed: true });
    expect(getProfile('sv-1')).toEqual(saved);
  });

  test('chuỗi rỗng nghĩa là xóa CCCD và SĐT (lưu null)', () => {
    saveProfile('sv-1', { name: 'Nguyễn Minh Anh', cccd: '079206001234', phone: '0901234567' });
    const saved = saveProfile('sv-1', { name: 'Nguyễn Minh Anh', cccd: '', phone: '' });
    expect(saved.cccd).toBeNull();
    expect(saved.phone).toBeNull();
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
