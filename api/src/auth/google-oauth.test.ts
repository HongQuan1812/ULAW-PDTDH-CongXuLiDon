import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildGoogleAuthorizeUrl,
  createGoogleLoginState,
  decodeGoogleLoginState,
  encodeGoogleLoginState,
  googleStateCookieOptions,
  readGoogleIdToken,
  toSafeReturnPath,
} from './google-oauth';

const GOOGLE = { clientId: 'client-123', clientSecret: 'secret', redirectUri: 'https://localhost:5173/api/auth/google/callback' };
const NOW = new Date('2026-11-14T00:00:00Z');

/** Dựng ID token giả (JWT không ký) với các claim cho trước. */
function fakeIdToken(claims: Record<string, unknown>): string {
  const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
  return `${encode({ alg: 'RS256' })}.${encode(claims)}.chu-ky`;
}

/** Claim hợp lệ, sửa từng trường để thử từng trường hợp. */
const VALID_CLAIMS = {
  iss: 'https://accounts.google.com',
  aud: GOOGLE.clientId,
  exp: NOW.getTime() / 1000 + 600,
  email: 'An.NV@Student.HCMULAW.edu.vn',
  email_verified: true,
  name: 'Nguyễn Văn An',
};

describe('toSafeReturnPath', () => {
  it('giữ đường dẫn nội bộ', () => {
    expect(toSafeReturnPath('/don/XMM-2026-001-00001')).toBe('/don/XMM-2026-001-00001');
  });

  it('chặn đường dẫn sang trang web khác hoặc giá trị lạ, trả về /', () => {
    for (const from of ['https://evil.com', '//evil.com', '/\\evil.com', 'quan-li-don', undefined, ['/a']]) {
      expect(toSafeReturnPath(from)).toBe('/');
    }
  });
});

describe('state trong cookie', () => {
  it('đóng gói rồi mở lại được y nguyên', () => {
    const loginState = createGoogleLoginState('/quan-li-don');
    expect(decodeGoogleLoginState(encodeGoogleLoginState(loginState))).toEqual(loginState);
  });

  it('mỗi lần một state, một mã PKCE khác', () => {
    const first = createGoogleLoginState('/');
    const second = createGoogleLoginState('/');
    expect(first.state).not.toBe(second.state);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });

  it('cookie hỏng, thiếu trường hoặc không có: null', () => {
    expect(decodeGoogleLoginState(null)).toBeNull();
    expect(decodeGoogleLoginState('khong-phai-base64-json')).toBeNull();
    expect(decodeGoogleLoginState(Buffer.from(JSON.stringify({ state: 'a' })).toString('base64url'))).toBeNull();
  });

  it('trang cần mở bị sửa thành trang ngoài thì về /', () => {
    const tampered = encodeGoogleLoginState({ state: 'a', codeVerifier: 'b', returnPath: '//evil.com' });
    expect(decodeGoogleLoginState(tampered)?.returnPath).toBe('/');
  });

  it('cookie httpOnly, chỉ gửi kèm /api/auth/google…, secure khi không phải dev', () => {
    expect(googleStateCookieOptions(true)).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false, path: '/api/auth/google' });
    expect(googleStateCookieOptions(false).secure).toBe(true);
  });
});

describe('buildGoogleAuthorizeUrl', () => {
  it('gửi đủ client, redirect URI, scope, state, PKCE S256; không gửi hd', () => {
    const loginState = createGoogleLoginState('/');
    const url = new URL(buildGoogleAuthorizeUrl(GOOGLE, loginState));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: GOOGLE.clientId,
      redirect_uri: GOOGLE.redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state: loginState.state,
      code_challenge: createHash('sha256').update(loginState.codeVerifier).digest('base64url'),
      code_challenge_method: 'S256',
    });
    expect(url.searchParams.has('hd')).toBe(false);
  });
});

describe('readGoogleIdToken', () => {
  it('token hợp lệ: chỉ lấy email, viết thường (không lấy họ tên)', () => {
    expect(readGoogleIdToken(fakeIdToken(VALID_CLAIMS), GOOGLE.clientId, NOW)).toEqual({ email: 'an.nv@student.hcmulaw.edu.vn' });
  });

  it('từ chối: sai người phát hành, sai client, hết hạn, email chưa xác minh, thiếu email, token hỏng', () => {
    const rejected = [
      fakeIdToken({ ...VALID_CLAIMS, iss: 'https://evil.com' }),
      fakeIdToken({ ...VALID_CLAIMS, aud: 'client-khac' }),
      fakeIdToken({ ...VALID_CLAIMS, exp: NOW.getTime() / 1000 - 1 }),
      fakeIdToken({ ...VALID_CLAIMS, email_verified: false }),
      fakeIdToken({ ...VALID_CLAIMS, email: undefined }),
      'khong-phai-jwt',
      'a.khong-phai-base64-json.c',
    ];
    for (const idToken of rejected) expect(readGoogleIdToken(idToken, GOOGLE.clientId, NOW)).toBeNull();
  });
});
