/* Test nhóm API Sao lưu: quyền, nơi lưu, lịch, sao lưu ngay (một hoặc nhiều nơi), giữ N bản, tải về, chạy theo lịch, lịch sử theo trang.
   Cần database đã migrate và seed. Thư mục sao lưu là một thư mục tạm (BACKUP_DIR đặt trước khi dựng app), xóa khi xong.
   Phần tạo tệp thật cần pg_dump (có trong image api); máy không có pg_dump thì bỏ qua các test đó.
   Xong thì trả nơi lưu, lịch về như seed và xóa lịch sử do test tạo. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import {
  ApiErrorBodySchema,
  BACKUP_ENDPOINTS,
  BACKUP_MESSAGES,
  BACKUP_SCHEDULES_SEED,
  BACKUP_TARGETS_SEED,
  BackupRunSchema,
  BackupRunsResponseSchema,
  BackupTargetSchema,
  BackupsResponseSchema,
  backupRunFilePath,
  backupSchedulePath,
  backupTargetPath,
  COMMON_MESSAGES,
  ConnectGoogleDriveResponseSchema,
  DriveConnectMessageSchema,
  DrivePickerResponseSchema,
  listQueryParams,
  type BackupTargetInput,
  type ListQuery,
  type RoleId,
} from '@ulaw/shared';
import { BackupsService } from '../src/backups/backups.service';
import { AppConfig } from '../src/config/app-config';
import { PrismaService } from '../src/common/prisma.service';
import { fromVietnamTime } from '../src/common/vietnam-time';
import { DRIVE_CONNECT_RESULT_ID } from '../src/backups/drive-connect-page';
import { createTestApp } from './create-test-app';

/** Máy chạy test có pg_dump không. */
const HAS_PG_DUMP = (() => {
  try {
    execFileSync('pg_dump', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Câu báo lỗi trong body response.
 * @param response  response lỗi
 * @returns         câu báo
 */
const messageOf = (response: Response) => ApiErrorBodySchema.parse(response.body).message;

/** Lịch mẫu (02:00 hằng ngày vào thư mục máy chủ), không có id. */
const { id: DAILY_SCHEDULE_ID, ...DAILY_SCHEDULE } = BACKUP_SCHEDULES_SEED[0]!;

/** Nơi lưu thử trên máy chủ. */
const TEST_TARGET: BackupTargetInput = { name: 'Thử', kind: 'serverFolder', folder: 'thu/hang-ngay', keepLatest: 2 };

describe('backups', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let backupsService: BackupsService;
  let backupDir: string;
  let adminCookie: string;
  const server = () => app.getHttpServer();
  const api = (endpoint: string) => `/api${endpoint}`;

  /** Đăng nhập thử, trả cookie để gửi kèm các request sau. */
  async function loginAs(role: RoleId): Promise<string> {
    const response = await request(server()).post('/api/auth/login').send({ role }).expect(200);
    return (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
  }

  /**
   * Một trang lịch sử.
   * @param changes  phần của lần hỏi trang khác mặc định (trang 1, 20 dòng)
   * @returns        trang đã kiểm theo schema
   */
  async function runsPage(changes: Partial<ListQuery> = {}) {
    const listQuery: ListQuery = { page: 1, pageSize: 20, search: '', sort: [], filters: [], ...changes };
    const response = await request(server()).get(api(BACKUP_ENDPOINTS.runs)).query(listQueryParams(listQuery)).set('Cookie', adminCookie).expect(200);
    return BackupRunsResponseSchema.parse(response.body);
  }

  /** Đưa nơi lưu, lịch về như seed; xóa lịch sử. */
  async function resetBackups(): Promise<void> {
    await prisma.backupRun.deleteMany();
    await prisma.backupTarget.deleteMany();
    await prisma.backupTarget.createMany({ data: [...BACKUP_TARGETS_SEED] });
    await prisma.backupSchedule.deleteMany();
    await prisma.backupSchedule.createMany({ data: BACKUP_SCHEDULES_SEED.map((schedule) => ({ ...schedule })) });
  }

  beforeAll(async () => {
    backupDir = mkdtempSync(path.join(tmpdir(), 'thu-sao-luu-'));
    process.env['BACKUP_DIR'] = backupDir;
    app = await createTestApp();
    prisma = app.get(PrismaService);
    backupsService = app.get(BackupsService);
    await resetBackups();
    adminCookie = await loginAs('admin');
  });

  afterAll(async () => {
    await backupsService.waitIdle();
    await resetBackups();
    await app.close();
    rmSync(backupDir, { recursive: true, force: true });
  });

  it('chưa đăng nhập: 401 · người xử lí đơn (không có quyền manageBackups): 403', async () => {
    expect(messageOf(await request(server()).get(api(BACKUP_ENDPOINTS.overview)).expect(401))).toBe(BACKUP_MESSAGES[401]);
    const cookie = await loginAs('nguoiXuLiDon');
    expect(messageOf(await request(server()).get(api(BACKUP_ENDPOINTS.overview)).set('Cookie', cookie).expect(403))).toBe(BACKUP_MESSAGES[403]);
    await request(server()).post(api(BACKUP_ENDPOINTS.download)).set('Cookie', cookie).expect(403);
  });

  it('tổng quan: nơi lưu và lịch của seed, chưa có lần nào, lần tới là 02:00', async () => {
    const response = await request(server()).get(api(BACKUP_ENDPOINTS.overview)).set('Cookie', adminCookie).expect(200);
    const overview = BackupsResponseSchema.parse(response.body);
    expect(overview.targets.map((target) => target.id)).toEqual(['backup-target-server']);
    expect(overview.schedules).toEqual(BACKUP_SCHEDULES_SEED);
    expect(overview.nextScheduledAt).toMatch(/T02:00$/);
    expect(overview).toMatchObject({ lastSuccessAt: null, running: false });
    expect(await runsPage()).toMatchObject({ runs: [], total: 0, page: 1 });
  });

  it('thêm, sửa, bỏ nơi lưu; trùng thư mục 409; thư mục ra ngoài BACKUP_DIR 422; bỏ thì lịch không còn lưu vào đó', async () => {
    const added = BackupTargetSchema.parse(
      (await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send(TEST_TARGET).expect(201)).body,
    );
    expect(added).toMatchObject({ ...TEST_TARGET, googleAccount: null, backupCount: 0 });

    const duplicate = await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send(TEST_TARGET).expect(409);
    expect(messageOf(duplicate)).toBe(BACKUP_MESSAGES.duplicateTarget);
    await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send({ ...TEST_TARGET, folder: '../ngoai' }).expect(422);

    const renamed = await request(server()).put(api(backupTargetPath(added.id))).set('Cookie', adminCookie).send({ ...TEST_TARGET, name: 'Thử 2' }).expect(200);
    expect(renamed.body.name).toBe('Thử 2');

    // Lịch lưu vào cả hai nơi; bỏ nơi thử thì lịch chỉ còn nơi của seed
    await request(server()).put(api(backupSchedulePath(DAILY_SCHEDULE_ID))).set('Cookie', adminCookie).send({ ...DAILY_SCHEDULE, targetIds: ['backup-target-server', added.id] }).expect(200);
    await request(server()).delete(api(backupTargetPath(added.id))).set('Cookie', adminCookie).expect(204);
    const overview = BackupsResponseSchema.parse((await request(server()).get(api(BACKUP_ENDPOINTS.overview)).set('Cookie', adminCookie)).body);
    expect(overview.schedules[0]!.targetIds).toEqual(['backup-target-server']);
    await request(server()).delete(api(backupTargetPath(added.id))).set('Cookie', adminCookie).expect(404);
  });

  it('lịch: thêm, sửa, bỏ nhiều lịch; lần tới là lịch sớm nhất; chọn nơi lưu không có / bật mà không chọn nơi nào thì 422', async () => {
    const dailyPath = api(backupSchedulePath(DAILY_SCHEDULE_ID));
    const unknown = await request(server()).put(dailyPath).set('Cookie', adminCookie).send({ ...DAILY_SCHEDULE, targetIds: ['khong-co'] }).expect(422);
    expect(messageOf(unknown)).toBe(BACKUP_MESSAGES.unknownScheduleTarget);
    await request(server()).put(dailyPath).set('Cookie', adminCookie).send({ ...DAILY_SCHEDULE, targetIds: [] }).expect(422);

    // Thêm lịch 01:00 hằng ngày: lần tới là 01:00
    const added = BackupsResponseSchema.parse(
      (await request(server()).post(api(BACKUP_ENDPOINTS.schedules)).set('Cookie', adminCookie).send({ ...DAILY_SCHEDULE, time: '01:00' }).expect(201)).body,
    );
    expect(added.schedules).toHaveLength(2);
    expect(added.nextScheduledAt).toMatch(/T01:00$/);
    const extraId = added.schedules[1]!.id;

    // Tắt cả hai thì không có lần tới
    await request(server()).put(api(backupSchedulePath(extraId))).set('Cookie', adminCookie).send({ ...DAILY_SCHEDULE, time: '01:00', enabled: false }).expect(200);
    const off = await request(server()).put(dailyPath).set('Cookie', adminCookie).send({ ...DAILY_SCHEDULE, enabled: false }).expect(200);
    expect(off.body.nextScheduledAt).toBeNull();

    // Bỏ lịch thêm; bỏ lần nữa thì 404; trả lịch mẫu về như cũ
    const removed = BackupsResponseSchema.parse((await request(server()).delete(api(backupSchedulePath(extraId))).set('Cookie', adminCookie).expect(200)).body);
    expect(removed.schedules.map((schedule) => schedule.id)).toEqual([DAILY_SCHEDULE_ID]);
    await request(server()).delete(api(backupSchedulePath(extraId))).set('Cookie', adminCookie).expect(404);
    await request(server()).put(dailyPath).set('Cookie', adminCookie).send(DAILY_SCHEDULE).expect(200);
  });

  it('Google Drive: phải kết nối (bản giả dev-google-drive-connect) và chọn thư mục rồi mới lưu được; kết nối dùng một lần; sửa thì giữ tài khoản cũ', async () => {
    const driveTarget = { name: 'Drive', kind: 'googleDrive' as const, folder: 'Sao lưu', driveFolderId: 'demo-thu-muc-1', keepLatest: 3 };
    const connect = async (body: object) =>
      ConnectGoogleDriveResponseSchema.parse((await request(server()).post(api(BACKUP_ENDPOINTS.driveConnect)).set('Cookie', adminCookie).send(body).expect(200)).body);

    // Chưa kết nối thì không lưu được
    const notConnected = await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send(driveTarget).expect(422);
    expect(messageOf(notConnected)).toBe(BACKUP_MESSAGES.driveConnectFirst);

    // Kết nối (bản giả trả ngay email gửi kèm); Picker của tài khoản giả: 'demo' (gõ tên thư mục)
    const connected = await connect({ email: 'Phong.DaoTao@gmail.com' });
    expect(connected).toMatchObject({ kind: 'connected', email: 'phong.daotao@gmail.com' });
    if (connected.kind !== 'connected') throw new Error('Bản giả phải trả connected');
    const picker = await request(server()).post(api(BACKUP_ENDPOINTS.drivePicker)).set('Cookie', adminCookie).send({ driveGrantId: connected.driveGrantId }).expect(200);
    expect(DrivePickerResponseSchema.parse(picker.body)).toEqual({ kind: 'demo' });
    await request(server()).post(api(BACKUP_ENDPOINTS.drivePicker)).set('Cookie', adminCookie).send({}).expect(422);

    // Chưa chọn thư mục thì không lưu được (lần kết nối vẫn còn); chọn rồi thì lưu kèm driveGrantId
    const { driveFolderId: _driveFolderId, ...withoutFolder } = driveTarget;
    const noFolder = await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send({ ...withoutFolder, driveGrantId: connected.driveGrantId }).expect(422);
    expect(messageOf(noFolder)).toBe('Chọn chỗ lưu trên Drive.');
    const added = BackupTargetSchema.parse(
      (await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send({ ...driveTarget, driveGrantId: connected.driveGrantId }).expect(201)).body,
    );
    expect(added).toMatchObject({ googleAccount: 'phong.daotao@gmail.com', folder: 'Sao lưu', driveFolderId: 'demo-thu-muc-1' });

    // driveGrantId chỉ dùng một lần
    const reused = await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send({ ...driveTarget, driveFolderId: 'khac', driveGrantId: connected.driveGrantId }).expect(422);
    expect(messageOf(reused)).toBe(BACKUP_MESSAGES.driveGrantExpired);

    // Hai nơi lưu cùng thư mục Drive (cùng id): 409; cùng tên thư mục nhưng khác id thì được
    const second = await connect({});
    if (second.kind !== 'connected') throw new Error('Bản giả phải trả connected');
    const sameFolder = await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send({ ...driveTarget, driveGrantId: second.driveGrantId }).expect(409);
    expect(messageOf(sameFolder)).toBe(BACKUP_MESSAGES.duplicateTarget);

    // Picker cho nơi lưu đang sửa: theo tài khoản của nơi lưu
    const editPicker = await request(server()).post(api(BACKUP_ENDPOINTS.drivePicker)).set('Cookie', adminCookie).send({ targetId: added.id }).expect(200);
    expect(editPicker.body).toEqual({ kind: 'demo' });

    // Lưu vào My Drive, kèm tên thư mục mới: tài khoản giả không gọi Google, thư mục giả mang tên đã gõ
    const inNewFolder = await request(server())
      .put(api(backupTargetPath(added.id)))
      .set('Cookie', adminCookie)
      .send({ ...driveTarget, driveFolderId: 'root', newDriveFolderName: ' Sao lưu mới ' })
      .expect(200);
    expect(inNewFolder.body.folder).toBe('Sao lưu mới');
    expect(inNewFolder.body.driveFolderId).toMatch(/^demo-/);
    const inMyDrive = await request(server()).put(api(backupTargetPath(added.id))).set('Cookie', adminCookie).send({ ...driveTarget, driveFolderId: 'root', folder: '' }).expect(200);
    expect(inMyDrive.body).toMatchObject({ folder: 'My Drive', driveFolderId: 'root' });

    // Sửa tên, không kết nối lại: giữ tài khoản; đổi sang thư mục máy chủ rồi về Drive thì phải kết nối lại
    const renamed = await request(server()).put(api(backupTargetPath(added.id))).set('Cookie', adminCookie).send({ ...driveTarget, name: 'Drive 2' }).expect(200);
    expect(renamed.body.googleAccount).toBe('phong.daotao@gmail.com');
    await request(server()).put(api(backupTargetPath(added.id))).set('Cookie', adminCookie).send({ ...driveTarget, kind: 'serverFolder', folder: 'tu-drive' }).expect(200);
    await request(server()).put(api(backupTargetPath(added.id))).set('Cookie', adminCookie).send(driveTarget).expect(422);

    // Nơi lưu không còn: 404
    await request(server()).post(api(BACKUP_ENDPOINTS.run)).set('Cookie', adminCookie).send({ targetIds: ['khong-co'] }).expect(404);
    await request(server()).post(api(BACKUP_ENDPOINTS.run)).set('Cookie', adminCookie).send({ targetIds: [] }).expect(422);
    await request(server()).delete(api(backupTargetPath(added.id))).set('Cookie', adminCookie).expect(204);
  });

  describe('Google Drive bản thật (tắt ENABLE_DEMO_APIS, giả lập phản hồi của Google)', () => {
    const PROJECT_NUMBER = '123456789012';
    const CLIENT_ID = `${PROJECT_NUMBER}-test-drive.apps.googleusercontent.com`;
    const PICKER_API_KEY = 'khoa-picker-thu';
    const CLIENT_SECRET = 'test-drive-secret';
    const DRIVE_EMAIL = 'drive.that@gmail.com';
    let appConfig: AppConfig;
    let original: { demoApisEnabled: boolean; google: AppConfig['google'] };

    /**
     * Dựng ID token giả (JWT không ký) Google trả về khi đổi code.
     * @param email  email của tài khoản
     * @returns      ID token
     */
    const fakeIdToken = (email: string) => {
      const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
      return `${encode({ alg: 'RS256' })}.${encode({ iss: 'https://accounts.google.com', aud: CLIENT_ID, exp: Date.now() / 1000 + 600, email, email_verified: true })}.chu-ky`;
    };

    /**
     * Đọc tin DriveConnectMessage trong trang callback.
     * @param response  response của GET callback
     * @returns         tin đã kiểm tra
     */
    const messageInPage = (response: Response) => {
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['content-security-policy']).toContain("script-src 'nonce-");
      const json = new RegExp(`<script type="application/json" id="${DRIVE_CONNECT_RESULT_ID}">(.*?)</script>`).exec(response.text)?.[1];
      return DriveConnectMessageSchema.parse(JSON.parse(json ?? 'null'));
    };

    /**
     * Bấm Kết nối Google: lấy đường dẫn sang Google và cookie state.
     * @returns  đường dẫn, cookie "tên=giá trị"
     */
    const startConnect = async () => {
      const response = await request(server()).post(api(BACKUP_ENDPOINTS.driveConnect)).set('Cookie', adminCookie).send({}).expect(200);
      const connectResponse = ConnectGoogleDriveResponseSchema.parse(response.body);
      if (connectResponse.kind !== 'redirect') throw new Error('Bản thật phải trả redirect');
      const stateCookie = ((response.headers['set-cookie'] as unknown as string[]) ?? []).find((cookie) => cookie.startsWith('ulaw_drive_oauth='));
      expect(stateCookie).toContain(`Path=/api${BACKUP_ENDPOINTS.googleDriveCallback}`);
      expect(stateCookie).toContain('HttpOnly');
      return { googleUrl: new URL(connectResponse.url), stateCookie: stateCookie!.split(';')[0]! };
    };

    /**
     * Google chuyển về callback.
     * @param query        tham số Google gửi kèm
     * @param stateCookie  cookie state; trống = không gửi
     * @returns            response (200, trang HTML)
     */
    const callback = (query: Record<string, string>, stateCookie?: string) =>
      request(server())
        .get(api(BACKUP_ENDPOINTS.googleDriveCallback))
        .query(query)
        .set('Cookie', [adminCookie, stateCookie].filter(Boolean).join('; '))
        .expect(200);

    /**
     * Dùng OAuth client thử (redirectUri của đăng nhập không dùng ở đây: Drive có redirect riêng).
     * @param pickerApiKey  API key của Picker; mặc định chưa có
     */
    const useTestGoogle = (pickerApiKey: string | null = null) => {
      (appConfig as { google: AppConfig['google'] }).google = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: 'khong-dung', pickerApiKey };
    };

    beforeAll(() => {
      appConfig = app.get(AppConfig);
      original = { demoApisEnabled: appConfig.demoApisEnabled, google: appConfig.google };
      (appConfig as { demoApisEnabled: boolean }).demoApisEnabled = false;
      useTestGoogle();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      useTestGoogle();
    });

    afterAll(() => {
      (appConfig as { demoApisEnabled: boolean }).demoApisEnabled = original.demoApisEnabled;
      (appConfig as { google: AppConfig['google'] }).google = original.google;
    });

    it('chưa cấu hình Google: 503', async () => {
      (appConfig as { google: AppConfig['google'] }).google = null;
      const response = await request(server()).post(api(BACKUP_ENDPOINTS.driveConnect)).set('Cookie', adminCookie).send({}).expect(503);
      expect(messageOf(response)).toBe(BACKUP_MESSAGES.driveUnavailable);
    });

    it('kết nối: sang Google xin drive.file, Google chuyển về thì trang báo driveGrantId; lưu nơi lưu kèm driveGrantId thì có tài khoản, token mã hóa', async () => {
      const { googleUrl, stateCookie } = await startConnect();
      expect(googleUrl.origin).toBe('https://accounts.google.com');
      expect(googleUrl.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/drive.file');
      expect(googleUrl.searchParams.get('redirect_uri')).toBe(new URL(`/api${BACKUP_ENDPOINTS.googleDriveCallback}`, appConfig.webBaseUrl).toString());
      expect(googleUrl.searchParams.get('access_type')).toBe('offline');
      expect(googleUrl.searchParams.get('code_challenge_method')).toBe('S256');

      // Google đổi code: trả refresh token và ID token
      const googleFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new globalThis.Response(JSON.stringify({ refresh_token: '1//refresh-that', id_token: fakeIdToken(DRIVE_EMAIL) }), { status: 200 }),
      );
      const message = messageInPage(await callback({ code: 'ma-google', state: googleUrl.searchParams.get('state')! }, stateCookie));
      expect(googleFetch).toHaveBeenCalledOnce();
      expect(message).toMatchObject({ ok: true, email: DRIVE_EMAIL });
      if (!message.ok) throw new Error('Phải kết nối được');

      // Picker: chưa có API key thì 503; có thì trả access token (đổi từ refresh token), API key, appId = số hiệu project
      vi.restoreAllMocks();
      const pickerRequest = () => request(server()).post(api(BACKUP_ENDPOINTS.drivePicker)).set('Cookie', adminCookie).send({ driveGrantId: message.driveGrantId });
      expect(messageOf(await pickerRequest().expect(503))).toBe(BACKUP_MESSAGES.pickerUnavailable);
      useTestGoogle(PICKER_API_KEY);
      const tokenFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new globalThis.Response(JSON.stringify({ access_token: 'ya29.ngan-han' }), { status: 200 }));
      expect(DrivePickerResponseSchema.parse((await pickerRequest().expect(200)).body)).toEqual({
        kind: 'picker',
        accessToken: 'ya29.ngan-han',
        apiKey: PICKER_API_KEY,
        appId: PROJECT_NUMBER,
      });
      expect(String(tokenFetch.mock.calls[0]?.[1]?.body)).toContain('refresh_token=1%2F%2Frefresh-that');

      /**
       * Giả lập Google: cấp access token, rồi trả thông tin thư mục.
       * @param folder  thư mục Drive trả về; null = 404 (cổng không mở được)
       */
      const mockDrive = (folder: object | null) => {
        vi.restoreAllMocks();
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
          String(input).startsWith('https://oauth2.googleapis.com')
            ? new globalThis.Response(JSON.stringify({ access_token: 'ya29.ngan-han' }), { status: 200 })
            : new globalThis.Response(JSON.stringify(folder ?? { error: 'notFound' }), { status: folder ? 200 : 404 }),
        );
      };
      const driveTarget = { name: 'Drive thật', kind: 'googleDrive', folder: 'tên giao diện gửi', driveFolderId: 'thu-muc-drive', keepLatest: 3, driveGrantId: message.driveGrantId };

      // Cổng không mở được thư mục, hoặc chọn nhầm tệp: 422, lần kết nối vẫn còn
      mockDrive(null);
      expect(messageOf(await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send(driveTarget).expect(422))).toBe(BACKUP_MESSAGES.driveFolderInvalid);
      mockDrive({ name: 'a.pdf', mimeType: 'application/pdf', trashed: false });
      await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send(driveTarget).expect(422);

      // Lưu nơi lưu: có tài khoản, tên thư mục lấy từ Drive; database chỉ giữ token đã mã hóa
      mockDrive({ name: 'WorkingSpace', mimeType: 'application/vnd.google-apps.folder', trashed: false });
      const added = BackupTargetSchema.parse((await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send(driveTarget).expect(201)).body);
      expect(added).toMatchObject({
        googleAccount: DRIVE_EMAIL,
        folder: 'WorkingSpace',
        driveFolderId: 'thu-muc-drive',
        driveFolderUrl: 'https://drive.google.com/drive/folders/thu-muc-drive',
      });
      const row = await prisma.backupTarget.findUniqueOrThrow({ where: { id: added.id } });
      expect(row.googleRefreshToken).toBeTruthy();
      expect(row.googleRefreshToken).not.toContain('refresh-that');

      // Sửa tên, giữ thư mục: không hỏi Drive
      vi.restoreAllMocks();
      const noGoogle = vi.spyOn(globalThis, 'fetch');
      const { driveGrantId: _driveGrantId, ...keepAccount } = driveTarget;
      const renamed = await request(server()).put(api(backupTargetPath(added.id))).set('Cookie', adminCookie).send({ ...keepAccount, name: 'Drive 2' }).expect(200);
      expect(renamed.body).toMatchObject({ name: 'Drive 2', folder: 'WorkingSpace' });
      expect(noGoogle).not.toHaveBeenCalled();

      // Giữ chỗ lưu, kèm tên thư mục mới: tạo bên trong chỗ lưu (gửi Drive đúng tên, kiểu thư mục, thư mục cha) rồi lưu vào thư mục mới
      vi.restoreAllMocks();
      const createFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
        String(input).startsWith('https://oauth2.googleapis.com')
          ? new globalThis.Response(JSON.stringify({ access_token: 'ya29.ngan-han' }), { status: 200 })
          : new globalThis.Response(JSON.stringify({ id: 'thu-muc-moi', name: 'Sao lưu cổng' }), { status: 200 }),
      );
      const inNewFolder = await request(server())
        .put(api(backupTargetPath(added.id)))
        .set('Cookie', adminCookie)
        .send({ ...keepAccount, newDriveFolderName: 'Sao lưu cổng' })
        .expect(200);
      expect(inNewFolder.body).toMatchObject({ folder: 'Sao lưu cổng', driveFolderId: 'thu-muc-moi' });
      expect(JSON.parse(String(createFetch.mock.calls[1]?.[1]?.body))).toEqual({
        name: 'Sao lưu cổng',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['thu-muc-drive'],
      });
      await request(server()).delete(api(backupTargetPath(added.id))).set('Cookie', adminCookie).expect(204);
    });

    it('bấm Hủy ở Google: denied · state sai, thiếu cookie, Google từ chối đổi code: failed', async () => {
      const { googleUrl, stateCookie } = await startConnect();
      const state = googleUrl.searchParams.get('state')!;
      expect(messageInPage(await callback({ error: 'access_denied', state }, stateCookie))).toMatchObject({ ok: false, error: 'denied' });
      expect(messageInPage(await callback({ code: 'ma', state: 'sai' }, stateCookie))).toMatchObject({ ok: false, error: 'failed' });
      expect(messageInPage(await callback({ code: 'ma', state }))).toMatchObject({ ok: false, error: 'failed' });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new globalThis.Response('{"error":"invalid_grant"}', { status: 400 }));
      expect(messageInPage(await callback({ code: 'ma', state }, stateCookie))).toMatchObject({ ok: false, error: 'failed' });
    });
  });

  it.skipIf(!HAS_PG_DUMP)('sao lưu ngay vào thư mục trên máy chủ: chạy nền, xong thì có tệp, tải về được; quá số bản giữ lại thì bản cũ bị xóa', async () => {
    await prisma.backupTarget.update({ where: { id: 'backup-target-server' }, data: { keepLatest: 1 } });
    const runIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const [started] = BackupRunSchema.array().parse((await request(server()).post(api(BACKUP_ENDPOINTS.run)).set('Cookie', adminCookie).send({ targetIds: ['backup-target-server'] }).expect(202)).body);
      expect(started!.status).toBe('running');
      runIds.push(started!.id);
      // Đang chạy thì bản khác 409
      if (i === 0) await request(server()).post(api(BACKUP_ENDPOINTS.download)).set('Cookie', adminCookie).expect(409);
      await backupsService.waitIdle();
      // Hai lần trong cùng một giây thì trùng tên tệp: chờ sang giây sau
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    const overview = BackupsResponseSchema.parse((await request(server()).get(api(BACKUP_ENDPOINTS.overview)).set('Cookie', adminCookie)).body);
    const { runs } = await runsPage();
    const [newer, older] = runIds.reverse().map((id) => runs.find((run) => run.id === id)!);
    expect(newer).toMatchObject({ status: 'ok', fileAvailable: true, pruned: false, trigger: 'manual', targetKind: 'serverFolder' });
    expect(newer!.sizeBytes).toBeGreaterThan(0);
    expect(older).toMatchObject({ status: 'ok', fileAvailable: false, pruned: true });
    expect(overview.targets[0]!.backupCount).toBe(1);
    expect(existsSync(path.join(backupDir, 'hang-ngay', newer!.fileName))).toBe(true);
    expect(existsSync(path.join(backupDir, 'hang-ngay', older!.fileName))).toBe(false);

    // Tải về bản còn; bản đã xóa thì 404
    const file = await request(server()).get(api(backupRunFilePath(newer!.id))).set('Cookie', adminCookie).buffer(true).expect(200);
    expect(file.headers['content-type']).toBe('application/gzip');
    expect(file.headers['content-disposition']).toContain(newer!.fileName);
    expect(messageOf(await request(server()).get(api(backupRunFilePath(older!.id))).set('Cookie', adminCookie).expect(404))).toBe(BACKUP_MESSAGES.fileGone);
  });

  it.skipIf(!HAS_PG_DUMP)('sao lưu rồi tải về máy: trả tệp .tar.gz, nhận đủ tệp mới ghi thành công, không giữ lại trên máy chủ', async () => {
    const response = await request(server()).post(api(BACKUP_ENDPOINTS.download)).set('Cookie', adminCookie).buffer(true).expect(200);
    expect(response.headers['content-disposition']).toMatch(/sao-luu-\d{8}-\d{6}\.tar\.gz/);
    expect(Number(response.headers['content-length'])).toBeGreaterThan(0);
    await backupsService.waitIdle();
    const run = await prisma.backupRun.findFirstOrThrow({ where: { targetKind: 'download' }, orderBy: { startedAt: 'desc' } });
    expect(run).toMatchObject({ status: 'ok', storagePath: null });
  });

  it.skipIf(!HAS_PG_DUMP)('sao lưu ngay vào hai nơi: một tệp, mỗi nơi một dòng lịch sử, cùng tên tệp', async () => {
    const second = BackupTargetSchema.parse(
      (await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send({ ...TEST_TARGET, folder: 'thu/hai-noi' }).expect(201)).body,
    );
    const started = BackupRunSchema.array().parse(
      (await request(server()).post(api(BACKUP_ENDPOINTS.run)).set('Cookie', adminCookie).send({ targetIds: ['backup-target-server', second.id] }).expect(202)).body,
    );
    expect(started.map((run) => run.targetName)).toEqual(['Trên máy chủ', TEST_TARGET.name]);
    await backupsService.waitIdle();

    const { runs } = await runsPage();
    const finished = started.map((startedRun) => runs.find((run) => run.id === startedRun.id)!);
    expect(finished.map((run) => run.status)).toEqual(['ok', 'ok']);
    expect(finished[0]!.fileName).toBe(finished[1]!.fileName);
    expect(existsSync(path.join(backupDir, 'hang-ngay', started[0]!.fileName))).toBe(true);
    expect(existsSync(path.join(backupDir, 'thu', 'hai-noi', started[1]!.fileName))).toBe(true);
    await request(server()).delete(api(backupTargetPath(second.id))).set('Cookie', adminCookie).expect(204);
  });

  it('lịch sử theo trang: tìm, lọc, sắp xếp như các bảng khác; điều kiện sai thì 422', async () => {
    // Ghi thẳng vài dòng lịch sử (không cần pg_dump)
    await prisma.backupRun.deleteMany();
    const day = (dayOfMonth: number) => fromVietnamTime(`2026-11-${String(dayOfMonth).padStart(2, '0')}T02:00`);
    await prisma.backupRun.createMany({
      data: Array.from({ length: 12 }, (_, index) => ({
        id: `backup-run-thu-${index + 1}`,
        startedAt: day(index + 1),
        finishedAt: day(index + 1),
        trigger: 'scheduled' as const,
        targetId: 'backup-target-server',
        targetName: index === 4 ? 'Drive phòng' : 'Trên máy chủ',
        targetKind: index === 4 ? 'googleDrive' : 'serverFolder',
        fileName: `sao-luu-202611${String(index + 1).padStart(2, '0')}-020000.tar.gz`,
        sizeBytes: index === 4 ? null : 1_000_000,
        status: index === 4 ? ('error' as const) : ('ok' as const),
        error: index === 4 ? 'Google Drive từ chối truy cập' : null,
        pruned: index < 2,
      })),
    });

    // Trang 2 (5 dòng mỗi trang), mới nhất trước
    const second = await runsPage({ page: 2, pageSize: 5 });
    expect(second).toMatchObject({ total: 12, page: 2 });
    expect(second.runs.map((run) => run.id)).toEqual([7, 6, 5, 4, 3].map((n) => `backup-run-thu-${n}`));

    // Tìm theo câu lỗi; lọc bản đã xóa; sắp xếp cũ nhất trước
    expect((await runsPage({ search: 'tu choi' })).runs.map((run) => run.id)).toEqual(['backup-run-thu-5']);
    expect((await runsPage({ filters: [{ fieldKey: 'status', operator: 'equals', value: 'pruned', from: '', to: '' }] })).total).toBe(2);
    expect((await runsPage({ sort: [{ id: 'startedAt', desc: false }], pageSize: 1 })).runs[0]!.id).toBe('backup-run-thu-1');

    // Cột không có thì 422
    const wrong = await request(server()).get(api(BACKUP_ENDPOINTS.runs)).query({ sort: 'khongCo:asc' }).set('Cookie', adminCookie).expect(422);
    expect(messageOf(wrong)).toBe(COMMON_MESSAGES.listQuery);
    await prisma.backupRun.deleteMany();
  });

  it.skipIf(!HAS_PG_DUMP)('chạy theo lịch: đúng phút thì chạy một lần, kiểm lại cùng phút (vd backend khởi động lại) không chạy trùng', async () => {
    const at = fromVietnamTime('2026-11-17T02:00');
    await backupsService.checkSchedule(at);
    await backupsService.checkSchedule(new Date(at.getTime() + 20_000));
    const runs = await prisma.backupRun.findMany({ where: { trigger: 'scheduled' } });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: 'ok', targetId: 'backup-target-server', startedById: null });

    // Sai phút thì không chạy
    await backupsService.checkSchedule(fromVietnamTime('2026-11-17T02:01'));
    expect(await prisma.backupRun.count({ where: { trigger: 'scheduled' } })).toBe(1);
  });
});
