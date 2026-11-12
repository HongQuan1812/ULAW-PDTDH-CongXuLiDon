import { describe, expect, it } from 'vitest';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_HOURS,
  generateSessionToken,
  hashSessionToken,
  readSessionToken,
  sessionCookieOptions,
  sessionExpiry,
} from './session-cookie';

describe('readSessionToken', () => {
  it('lấy mã phiên giữa các cookie khác', () => {
    expect(readSessionToken(`a=1; ${SESSION_COOKIE_NAME}=abc123; b=2`)).toBe('abc123');
  });

  it('trả null khi không có header, không có cookie phiên hoặc cookie phiên rỗng', () => {
    expect(readSessionToken(undefined)).toBeNull();
    expect(readSessionToken('a=1; b=2')).toBeNull();
    expect(readSessionToken(`${SESSION_COOKIE_NAME}=`)).toBeNull();
  });

  it('không nhầm cookie có tên chứa tên cookie phiên', () => {
    expect(readSessionToken(`x_${SESSION_COOKIE_NAME}=abc`)).toBeNull();
  });
});

describe('mã phiên', () => {
  it('mỗi lần sinh ra một mã khác, 64 ký tự hex', () => {
    const first = generateSessionToken();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(generateSessionToken()).not.toBe(first);
  });

  it('băm ổn định và khác mã gốc', () => {
    expect(hashSessionToken('abc')).toBe(hashSessionToken('abc'));
    expect(hashSessionToken('abc')).not.toBe('abc');
    expect(hashSessionToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('thời hạn và thuộc tính cookie', () => {
  it('hết hạn sau SESSION_TTL_HOURS giờ', () => {
    const now = new Date('2026-11-12T00:00:00Z');
    expect(sessionExpiry(now).getTime() - now.getTime()).toBe(SESSION_TTL_HOURS * 3600_000);
  });

  it('luôn httpOnly; secure chỉ khi không phải dev', () => {
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false });
    expect(sessionCookieOptions(false).secure).toBe(true);
  });
});
