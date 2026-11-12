/* Cookie phiên đăng nhập: tên, thuộc tính, đọc mã từ header, băm mã để lưu database. */
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions } from 'express';

/** Tên cookie chứa mã phiên. */
export const SESSION_COOKIE_NAME = 'ulaw_session';

/** Phiên sống bao nhiêu giờ kể từ lúc đăng nhập. */
export const SESSION_TTL_HOURS = 12;

/** Số mili giây của một giờ. */
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Thời điểm phiên hết hạn.
 * @param now  lúc đăng nhập
 * @returns    now cộng SESSION_TTL_HOURS giờ
 */
export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_HOURS * MS_PER_HOUR);
}

/**
 * Thuộc tính cookie: JavaScript trong trang không đọc được (httpOnly), không gửi kèm khi bấm từ trang web khác (lax),
 * chỉ đi qua HTTPS khi chạy bản thật.
 * @param isDev  true khi APP_ENV = "dev" (chạy http://localhost nên không đặt secure)
 * @returns      thuộc tính truyền vào response.cookie()
 */
export function sessionCookieOptions(isDev: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: !isDev, path: '/', maxAge: SESSION_TTL_HOURS * MS_PER_HOUR };
}

/**
 * Sinh mã phiên ngẫu nhiên, khó đoán.
 * @returns  chuỗi 64 ký tự hex (256 bit)
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Băm mã phiên. Database chỉ giữ bản băm, nên lộ database cũng không dùng được để đăng nhập.
 * @param token  mã phiên trong cookie
 * @returns      SHA-256 dạng hex
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Đọc mã phiên từ header Cookie của request.
 * @param cookieHeader  giá trị header Cookie, vd "a=1; ulaw_session=abc"; undefined nếu không có
 * @returns             mã phiên; không có cookie phiên thì null
 */
export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separatorAt = part.indexOf('=');
    if (separatorAt < 0) continue;
    if (part.slice(0, separatorAt).trim() === SESSION_COOKIE_NAME) return part.slice(separatorAt + 1).trim() || null;
  }
  return null;
}
