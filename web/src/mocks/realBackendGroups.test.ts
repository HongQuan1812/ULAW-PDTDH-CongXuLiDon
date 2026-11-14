import { describe, expect, test } from 'vitest';
import { parseRealBackendGroups } from './realBackendGroups';

describe('parseRealBackendGroups', () => {
  test('tách theo dấu phẩy, bỏ khoảng trắng; bỏ trống = không nhóm nào', () => {
    expect([...parseRealBackendGroups(' health, auth ,profile')]).toEqual(['health', 'auth', 'profile']);
    expect(parseRealBackendGroups('').size).toBe(0);
    expect(parseRealBackendGroups(undefined).size).toBe(0);
  });

  test('tên nhóm không tồn tại: báo lỗi nêu tên sai', () => {
    expect(() => parseRealBackendGroups('health,authh')).toThrow(/authh/);
  });
});
