/* Gọi Google: đổi mã (code) Google trả về lấy ID token, rồi đọc email trong đó. */
import { Injectable, Logger } from '@nestjs/common';
import type { GoogleOAuthConfig } from '../config/app-config';
import { GOOGLE_TOKEN_URL, readGoogleIdToken, type GoogleIdentity } from './google-oauth';

/** Chờ Google trả lời tối đa bấy nhiêu mili giây. */
const GOOGLE_TOKEN_TIMEOUT_MS = 10_000;

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  /**
   * Đổi code lấy ID token và đọc người dùng trong đó.
   * @param google        OAuth client
   * @param code          mã Google gửi kèm khi chuyển về
   * @param codeVerifier  mã PKCE đã tạo lúc chuyển sang Google
   * @returns             email; Google từ chối hoặc token không hợp lệ thì null (đã ghi log)
   */
  async exchangeCode(google: GoogleOAuthConfig, code: string, codeVerifier: string): Promise<GoogleIdentity | null> {
    // Gửi code kèm bí mật của client và mã PKCE
    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: google.clientId,
          client_secret: google.clientSecret,
          redirect_uri: google.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(GOOGLE_TOKEN_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`Không gọi được Google để đổi code: ${String(error)}`);
      return null;
    }

    // Google từ chối (code sai / đã dùng, sai bí mật, sai redirect URI…)
    if (!tokenResponse.ok) {
      this.logger.warn(`Google từ chối đổi code (${tokenResponse.status}): ${await tokenResponse.text()}`);
      return null;
    }

    // Đọc ID token
    const tokenBody = (await tokenResponse.json()) as { id_token?: unknown };
    const identity = typeof tokenBody.id_token === 'string' ? readGoogleIdToken(tokenBody.id_token, google.clientId, new Date()) : null;
    if (!identity) this.logger.warn('ID token Google trả về không hợp lệ hoặc email chưa xác minh.');
    return identity;
  }
}
