import { describe, expect, test } from 'vitest';
import { decodeDriveState, decryptToken, encodeDriveState, encryptToken } from './google-drive-backup.service';
import { pgEnvOf } from './backup-archive';

describe('Google Drive của trang Sao lưu', () => {
  test('refresh token mã hóa rồi giải mã lại được; sai bí mật (đã đổi GOOGLE_CLIENT_SECRET) thì không đọc được', () => {
    const stored = encryptToken('1//refresh-token', 'bi-mat');
    expect(stored).not.toContain('refresh-token');
    expect(decryptToken(stored, 'bi-mat')).toBe('1//refresh-token');
    expect(decryptToken(stored, 'bi-mat-khac')).toBeNull();
    expect(decryptToken('hong', 'bi-mat')).toBeNull();
  });

  test('state trong cookie: đóng gói, mở gói; hỏng thì null', () => {
    const connectState = { state: 's', codeVerifier: 'v', targetId: 't' };
    expect(decodeDriveState(encodeDriveState(connectState))).toEqual(connectState);
    expect(decodeDriveState('hong')).toBeNull();
    expect(decodeDriveState(null)).toBeNull();
  });
});

describe('pgEnvOf', () => {
  test('đọc chuỗi kết nối thành biến libpq, bỏ ?schema của Prisma, giải mã mật khẩu', () => {
    expect(pgEnvOf('postgresql://ulaw:p%40ss@postgres:5432/cong_xu_li_don?schema=public')).toEqual({
      PGHOST: 'postgres',
      PGPORT: '5432',
      PGUSER: 'ulaw',
      PGPASSWORD: 'p@ss',
      PGDATABASE: 'cong_xu_li_don',
    });
  });
});
