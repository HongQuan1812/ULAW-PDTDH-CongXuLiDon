/* Các hàm thuần của đăng nhập Google (OAuth 2.0 / OpenID Connect, luồng authorization code + PKCE):
   dựng đường dẫn sang Google, cookie giữ state giữa hai lần chuyển trang, kiểm tra ID token Google trả về. */
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions } from 'express';
import type { GoogleOAuthConfig } from '../config/app-config';

/** Trang chọn tài khoản của Google. */
export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
/** Nơi đổi mã (code) lấy token. */
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Hai cách Google ghi người phát hành ID token. */
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** Cookie giữ state, mã PKCE và trang cần mở, từ lúc sang Google tới lúc Google chuyển về. */
export const GOOGLE_STATE_COOKIE_NAME = 'ulaw_google_oauth';
/** Đường dẫn của cookie state: chỉ gửi kèm các request /api/auth/google… */
const GOOGLE_STATE_COOKIE_PATH = '/api/auth/google';
/** Chọn tài khoản Google quá thời gian này thì phải bắt đầu lại. */
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

/** Những gì cần nhớ giữa hai lần chuyển trang. */
export interface GoogleLoginState {
  /** chuỗi ngẫu nhiên, Google trả lại y nguyên: chống trang khác giả mạo lần chuyển về */
  state: string;
  /** mã PKCE: chỉ máy chủ này đổi được code lấy token */
  codeVerifier: string;
  /** trang trong giao diện cần mở sau khi đăng nhập, vd '/don/XMM-2026-001-00001' */
  returnPath: string;
}

/** Thông tin người dùng lấy từ ID token. Không lấy họ tên: người dùng tự nhập ở màn Bổ sung thông tin. */
export interface GoogleIdentity {
  /** email đã được Google xác minh, viết thường */
  email: string;
}

/**
 * Tạo state và mã PKCE mới cho một lần đăng nhập.
 * @param returnPath  trang cần mở sau khi đăng nhập (đã qua toSafeReturnPath)
 * @returns           state, codeVerifier, returnPath
 */
export function createGoogleLoginState(returnPath: string): GoogleLoginState {
  return { state: randomBytes(24).toString('base64url'), codeVerifier: randomBytes(48).toString('base64url'), returnPath };
}

/**
 * Chỉ giữ đường dẫn nội bộ của giao diện, để không ai lợi dụng ?from= chuyển người dùng sang trang web khác.
 * @param from  giá trị ?from= trên đường dẫn, vd '/quan-li-don'
 * @returns     from nếu bắt đầu bằng một dấu '/' (không phải '//' hay '/\'), không thì '/'
 */
export function toSafeReturnPath(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/')) return '/';
  if (from.startsWith('//') || from.startsWith('/\\')) return '/';
  return from;
}

/**
 * Dựng đường dẫn sang trang chọn tài khoản Google.
 * Không gửi tham số hd: tên miền được nhận do SCHOOL_EMAIL_DOMAINS quyết định và máy chủ kiểm tra khi Google chuyển về,
 * nên thêm tên miền (kể cả tên miền ngoài trường) chỉ cần sửa danh sách đó.
 * @param google      OAuth client
 * @param loginState  state và mã PKCE của lần đăng nhập này
 * @returns           URL đầy đủ để chuyển trình duyệt sang
 */
export function buildGoogleAuthorizeUrl(google: GoogleOAuthConfig, loginState: GoogleLoginState): string {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: google.redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state: loginState.state,
    code_challenge: createHash('sha256').update(loginState.codeVerifier).digest('base64url'),
    code_challenge_method: 'S256',
    // Luôn cho chọn tài khoản, để máy có nhiều tài khoản Google không tự vào nhầm tài khoản cá nhân
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

/**
 * Đóng gói state để đặt vào cookie.
 * @param loginState  state, mã PKCE, trang cần mở
 * @returns           chuỗi base64url
 */
export function encodeGoogleLoginState(loginState: GoogleLoginState): string {
  return Buffer.from(JSON.stringify(loginState)).toString('base64url');
}

/**
 * Mở gói state đọc từ cookie.
 * @param cookieValue  giá trị cookie; không có thì null
 * @returns            state; cookie hỏng hoặc thiếu trường thì null
 */
export function decodeGoogleLoginState(cookieValue: string | null): GoogleLoginState | null {
  if (!cookieValue) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cookieValue, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { state, codeVerifier, returnPath } = parsed as Record<string, unknown>;
    if (typeof state !== 'string' || typeof codeVerifier !== 'string' || typeof returnPath !== 'string') return null;
    return { state, codeVerifier, returnPath: toSafeReturnPath(returnPath) };
  } catch {
    return null;
  }
}

/**
 * Thuộc tính cookie state: httpOnly, lax (vẫn được gửi khi Google chuyển trình duyệt về), sống 10 phút.
 * @param isDev  true khi APP_ENV = "dev" (không đặt secure)
 * @returns      thuộc tính truyền vào response.cookie() / clearCookie()
 */
export function googleStateCookieOptions(isDev: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: !isDev, path: GOOGLE_STATE_COOKIE_PATH, maxAge: GOOGLE_STATE_TTL_MS };
}

/**
 * Đọc và kiểm tra ID token Google trả về khi đổi code. Token nhận thẳng từ Google qua HTTPS (không qua trình duyệt),
 * nên theo OpenID Connect không cần kiểm tra chữ ký; vẫn kiểm tra người phát hành, client, hạn dùng và email đã xác minh.
 * @param idToken   ID token (JWT) trong response của GOOGLE_TOKEN_URL
 * @param clientId  GOOGLE_CLIENT_ID của cổng
 * @param now       thời điểm hiện tại
 * @returns         email (viết thường); token sai hoặc email chưa xác minh thì null
 */
export function readGoogleIdToken(idToken: string, clientId: string, now: Date): GoogleIdentity | null {
  // Phần giữa của JWT là dữ liệu (claims) dạng base64url
  const payloadPart = idToken.split('.')[1];
  if (!payloadPart) return null;
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }

  // Đúng Google phát hành, đúng cho cổng này, còn hạn
  if (!GOOGLE_ISSUERS.includes(String(claims['iss']))) return null;
  if (claims['aud'] !== clientId) return null;
  if (typeof claims['exp'] !== 'number' || claims['exp'] * 1000 <= now.getTime()) return null;

  // Email phải có và đã được Google xác minh
  if (typeof claims['email'] !== 'string' || claims['email_verified'] !== true) return null;
  return { email: claims['email'].toLowerCase() };
}
