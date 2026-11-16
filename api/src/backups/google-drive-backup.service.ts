/* Nơi lưu Google Drive của trang Sao lưu: kết nối tài khoản Google (OAuth, quyền drive.file: cổng chỉ thấy tệp, thư mục do chính nó tạo),
   tải tệp sao lưu lên, xóa bản cũ. Dùng OAuth client của đăng nhập Google (GOOGLE_CLIENT_ID), với redirect URI riêng
   <địa chỉ cổng>/api/backups/google-drive/callback (phải khai báo thêm trong OAuth client).
   Refresh token mã hóa AES-256-GCM (khóa băm từ GOOGLE_CLIENT_SECRET) trước khi lưu; đổi bí mật thì phải kết nối lại. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import type { CookieOptions } from 'express';
import { BACKUP_ENDPOINTS } from '@ulaw/shared';
import { GOOGLE_AUTHORIZE_URL, GOOGLE_TOKEN_URL, readGoogleIdToken } from '../auth/google-oauth';
import { AppConfig, type GoogleOAuthConfig } from '../config/app-config';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/prisma.service';

/** Quyền xin Google: email (biết tài khoản nào) và drive.file (chỉ tệp do cổng tạo). */
const DRIVE_SCOPES = 'openid email https://www.googleapis.com/auth/drive.file';
/** Cookie giữ state, mã PKCE, nơi lưu đang kết nối, từ lúc sang Google tới lúc Google chuyển về. */
export const DRIVE_STATE_COOKIE_NAME = 'ulaw_drive_oauth';
/** Đường dẫn Google chuyển về (sau địa chỉ gốc của cổng). */
const DRIVE_CALLBACK_PATH = `/api${BACKUP_ENDPOINTS.googleDriveCallback}`;
/** Chờ Google trả lời tối đa (gọi API), mili giây; tải tệp lên không giới hạn. */
const GOOGLE_TIMEOUT_MS = 15_000;
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';

type BackupTargetRow = Prisma.BackupTargetGetPayload<object>;

/** Một lần kết nối tài khoản Drive chưa gắn vào nơi lưu nào (chờ Admin bấm Lưu). */
export interface DriveGrant {
  /** email tài khoản Google */
  email: string;
  /** refresh token đã mã hóa; null = bản giả dev-backup-drive (không có quyền thật) */
  encryptedRefreshToken: string | null;
}

/** Lần kết nối giữ được bao lâu nếu chưa bấm Lưu, mili giây. */
const DRIVE_GRANT_TTL_MS = 30 * 60 * 1000;

/** Những gì cần nhớ giữa hai lần chuyển trang. */
export interface DriveConnectState {
  state: string;
  codeVerifier: string;
  targetId: string;
}

/**
 * Khóa mã hóa refresh token, băm từ bí mật của OAuth client.
 * @param clientSecret  GOOGLE_CLIENT_SECRET
 * @returns             32 byte
 */
function tokenKey(clientSecret: string): Buffer {
  return createHash('sha256').update(`sao-luu-drive:${clientSecret}`).digest();
}

/**
 * Mã hóa refresh token để lưu vào database.
 * @param token         refresh token
 * @param clientSecret  GOOGLE_CLIENT_SECRET
 * @returns             'iv.tag.dữ liệu' (base64url)
 */
export function encryptToken(token: string, clientSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenKey(clientSecret), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

/**
 * Giải mã refresh token đã lưu.
 * @param stored        chuỗi từ encryptToken
 * @param clientSecret  GOOGLE_CLIENT_SECRET
 * @returns             refresh token; sai khóa (đã đổi bí mật) hoặc hỏng thì null
 */
export function decryptToken(stored: string, clientSecret: string): string | null {
  try {
    const [iv, tag, encrypted] = stored.split('.').map((part) => Buffer.from(part, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', tokenKey(clientSecret), iv!);
    decipher.setAuthTag(tag!);
    return Buffer.concat([decipher.update(encrypted!), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Đóng gói / mở gói state đặt trong cookie.
 * @param connectState  state, mã PKCE, nơi lưu
 * @returns             chuỗi base64url
 */
export function encodeDriveState(connectState: DriveConnectState): string {
  return Buffer.from(JSON.stringify(connectState)).toString('base64url');
}

/**
 * @param cookieValue  giá trị cookie; không có thì null
 * @returns            state; hỏng hoặc thiếu trường thì null
 */
export function decodeDriveState(cookieValue: string | null): DriveConnectState | null {
  if (!cookieValue) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cookieValue, 'base64url').toString('utf8')) as Record<string, unknown>;
    const { state, codeVerifier, targetId } = parsed;
    if (typeof state !== 'string' || typeof codeVerifier !== 'string' || typeof targetId !== 'string') return null;
    return { state, codeVerifier, targetId };
  } catch {
    return null;
  }
}

/**
 * Thuộc tính cookie state: httpOnly, lax (vẫn gửi khi Google chuyển về), chỉ gửi kèm request của callback, sống 10 phút.
 * @param isDev  APP_ENV = "dev" (không đặt secure)
 * @returns      thuộc tính cookie
 */
export function driveStateCookieOptions(isDev: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: !isDev, path: DRIVE_CALLBACK_PATH, maxAge: 10 * 60 * 1000 };
}

/**
 * Câu lỗi đọc được từ response lỗi của Google.
 * @param response  response không thành công
 * @param action    đang làm gì, vd 'tải tệp lên Drive'
 * @returns         câu lỗi
 */
async function googleError(response: Response, action: string): Promise<Error> {
  const body = (await response.text()).slice(0, 300);
  return new Error(`Google Drive từ chối ${action} (${response.status}): ${body}`);
}

@Injectable()
export class GoogleDriveBackupService {
  /** Các lần kết nối đang chờ Lưu, theo driveGrantId. Giữ trong bộ nhớ: backend khởi động lại thì phải kết nối lại. */
  private readonly grants = new Map<string, DriveGrant & { userId: string; expiresAt: number }>();
  /**
   * @param config  OAuth client của Google, địa chỉ gốc của cổng
   * @param prisma  lưu tài khoản, token, thư mục của nơi lưu
   */
  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  /** Máy chủ đã có OAuth client Google chưa. */
  get available(): boolean {
    return this.config.google !== null;
  }

  /**
   * Giữ một lần kết nối tài khoản Drive để Admin gắn vào nơi lưu khi bấm Lưu.
   * @param userId  người kết nối (chỉ người này dùng được)
   * @param grant   email và refresh token đã mã hóa
   * @returns       driveGrantId (ngẫu nhiên, dùng một lần)
   */
  createGrant(userId: string, grant: DriveGrant): string {
    const now = Date.now();
    for (const [grantId, stored] of this.grants) if (stored.expiresAt <= now) this.grants.delete(grantId);
    const grantId = randomBytes(24).toString('base64url');
    this.grants.set(grantId, { ...grant, userId, expiresAt: now + DRIVE_GRANT_TTL_MS });
    return grantId;
  }

  /**
   * Lấy (và bỏ) một lần kết nối để gắn vào nơi lưu.
   * @param grantId  driveGrantId giao diện gửi kèm
   * @param userId   người đang lưu
   * @returns        email, refresh token; không có, quá hạn hoặc của người khác thì null
   */
  takeGrant(grantId: string, userId: string): DriveGrant | null {
    const stored = this.grants.get(grantId);
    if (!stored || stored.userId !== userId || stored.expiresAt <= Date.now()) return null;
    this.grants.delete(grantId);
    return { email: stored.email, encryptedRefreshToken: stored.encryptedRefreshToken };
  }

  /**
   * OAuth client, kèm redirect URI riêng của Drive.
   * @returns  cấu hình; chưa có thì null
   */
  private get google(): (GoogleOAuthConfig & { driveRedirectUri: string }) | null {
    const google = this.config.google;
    return google ? { ...google, driveRedirectUri: new URL(DRIVE_CALLBACK_PATH, this.config.webBaseUrl).toString() } : null;
  }

  /**
   * Bắt đầu kết nối: tạo state, mã PKCE và đường dẫn sang Google.
   * @param targetId  nơi lưu kiểu googleDrive
   * @returns         state cần đặt vào cookie và đường dẫn; chưa có OAuth client thì null
   */
  startConnect(targetId: string): { connectState: DriveConnectState; url: string } | null {
    const google = this.google;
    if (!google) return null;
    const connectState = { state: randomBytes(24).toString('base64url'), codeVerifier: randomBytes(48).toString('base64url'), targetId };
    const url = new URL(GOOGLE_AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.driveRedirectUri,
      response_type: 'code',
      scope: DRIVE_SCOPES,
      state: connectState.state,
      code_challenge: createHash('sha256').update(connectState.codeVerifier).digest('base64url'),
      code_challenge_method: 'S256',
      // Xin refresh token để cổng tự lưu theo lịch khi không ai đăng nhập; consent để lần nào cũng nhận refresh token
      access_type: 'offline',
      prompt: 'consent select_account',
    }).toString();
    return { connectState, url: url.toString() };
  }

  /**
   * Google chuyển về: đổi code lấy refresh token và email, lưu vào nơi lưu (mã hóa).
   * @param connectState  state đọc từ cookie
   * @param code          mã Google gửi kèm
   * @returns             true khi đã lưu; Google từ chối, không có refresh token, nơi lưu không còn thì false
   */
  async finishConnect(connectState: DriveConnectState, code: string): Promise<boolean> {
    const google = this.google;
    if (!google) return false;
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: google.driveRedirectUri,
        grant_type: 'authorization_code',
        code_verifier: connectState.codeVerifier,
      }),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    }).catch(() => null);
    if (!tokenResponse?.ok) return false;

    // Cần cả refresh token và email đã xác minh
    const tokens = (await tokenResponse.json()) as { refresh_token?: unknown; id_token?: unknown };
    const identity = typeof tokens.id_token === 'string' ? readGoogleIdToken(tokens.id_token, google.clientId, new Date()) : null;
    if (typeof tokens.refresh_token !== 'string' || !identity) return false;
    const updated = await this.prisma.backupTarget.updateMany({
      where: { id: connectState.targetId, kind: 'googleDrive' },
      data: { googleAccount: identity.email, googleRefreshToken: encryptToken(tokens.refresh_token, google.clientSecret), googleFolderId: null },
    });
    return updated.count === 1;
  }

  /**
   * Lấy access token mới từ refresh token đã lưu.
   * @param target  nơi lưu Drive
   * @returns       access token
   * @throws        lỗi khi chưa kết nối, đã đổi GOOGLE_CLIENT_SECRET, hoặc tài khoản đã thu hồi quyền
   */
  private async accessToken(target: BackupTargetRow): Promise<string> {
    const google = this.google;
    if (!google) throw new Error('Máy chủ chưa cấu hình Google (GOOGLE_CLIENT_ID).');
    const refreshToken = target.googleRefreshToken ? decryptToken(target.googleRefreshToken, google.clientSecret) : null;
    if (!refreshToken && target.googleAccount && !target.googleRefreshToken) {
      throw new Error('Tài khoản Google này được kết nối bằng bản giả (dev-backup-drive), không lưu thật lên Drive được.');
    }
    if (!refreshToken) throw new Error('Chưa kết nối tài khoản Google Drive (hoặc cần kết nối lại).');
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: google.clientId, client_secret: google.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    if (response.status === 400) throw new Error('Tài khoản Google đã thu hồi quyền hoặc hết hạn: sửa nơi lưu, bấm “Đổi tài khoản” để kết nối lại.');
    if (!response.ok) throw await googleError(response, 'cấp quyền');
    return ((await response.json()) as { access_token: string }).access_token;
  }

  /**
   * Thư mục của nơi lưu trên Drive: đã tạo và còn thì dùng lại, không thì tạo mới (ở thư mục gốc của Drive) rồi nhớ id.
   * @param target       nơi lưu Drive
   * @param accessToken  access token
   * @returns            id thư mục
   */
  private async folderId(target: BackupTargetRow, accessToken: string): Promise<string> {
    const headers = { Authorization: `Bearer ${accessToken}` };
    if (target.googleFolderId) {
      const existing = await fetch(`${DRIVE_FILES_URL}/${target.googleFolderId}?fields=id,trashed`, { headers, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) });
      if (existing.ok && !((await existing.json()) as { trashed?: boolean }).trashed) return target.googleFolderId;
    }
    const created = await fetch(DRIVE_FILES_URL, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: target.folder, mimeType: 'application/vnd.google-apps.folder' }),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    if (!created.ok) throw await googleError(created, 'tạo thư mục');
    const { id } = (await created.json()) as { id: string };
    await this.prisma.backupTarget.update({ where: { id: target.id }, data: { googleFolderId: id } });
    return id;
  }

  /**
   * Tải tệp sao lưu lên thư mục của nơi lưu (tải kiểu resumable, đọc dần từ ổ đĩa).
   * @param target    nơi lưu Drive
   * @param filePath  tệp trên máy chủ
   * @param fileName  tên tệp trên Drive
   * @returns         id tệp trên Drive
   */
  async upload(target: BackupTargetRow, filePath: string, fileName: string): Promise<string> {
    const accessToken = await this.accessToken(target);
    const parentId = await this.folderId(target, accessToken);
    const { size } = await stat(filePath);

    // Mở phiên tải lên, rồi gửi cả tệp
    const session = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'application/gzip', 'X-Upload-Content-Length': String(size) },
      body: JSON.stringify({ name: fileName, parents: [parentId] }),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    const uploadUrl = session.headers.get('Location');
    if (!session.ok || !uploadUrl) throw await googleError(session, 'mở phiên tải lên');
    const uploaded = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/gzip', 'Content-Length': String(size) },
      body: Readable.toWeb(createReadStream(filePath)) as ReadableStream,
      duplex: 'half',
    } as RequestInit);
    if (!uploaded.ok) throw await googleError(uploaded, 'tải tệp lên');
    return ((await uploaded.json()) as { id: string }).id;
  }

  /**
   * Xóa một bản cũ trên Drive (đã không còn thì thôi).
   * @param target       nơi lưu Drive
   * @param driveFileId  id tệp
   */
  async remove(target: BackupTargetRow, driveFileId: string): Promise<void> {
    const accessToken = await this.accessToken(target);
    const response = await fetch(`${DRIVE_FILES_URL}/${driveFileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    if (!response.ok && response.status !== 404) throw await googleError(response, 'xóa bản cũ');
  }
}
