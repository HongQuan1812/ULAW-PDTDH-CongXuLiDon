/* API giả: Sao lưu (nơi lưu, sao lưu ngay, lịch định kì, lịch sử). Chỉ vai trò có quyền manageBackups.
   Không sao lưu thật: lần sao lưu tự xong sau vài giây, tệp tải về là tệp giả. */
import { delay, http, HttpResponse } from 'msw';
import {
  BACKUP_MESSAGES,
  BackupScheduleSchema,
  BackupTargetInputSchema,
  ENDPOINTS,
  RunBackupRequestSchema,
  can,
  type BackupRun,
  type BackupTarget,
  type BackupsResponse,
  type ConnectGoogleDriveResponse,
} from '@ulaw/shared';
import {
  connectBackupDrive,
  findBackupRun,
  getBackupsOverview,
  readSession,
  recordBackupDownload,
  removeBackupTarget,
  saveBackupSchedule,
  saveBackupTarget,
  startBackupRun,
} from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';
import { PAGE_PATH } from '../../app/paths';

/**
 * Người đang đăng nhập, nếu có quyền sao lưu.
 * @returns  phiên đăng nhập; hoặc response lỗi 401 / 403 để trả luôn
 */
async function backupSession() {
  const session = await readSession();
  if (!session) return apiError(401, BACKUP_MESSAGES[401]);
  if (!can(session.role, 'manageBackups')) return apiError(403, BACKUP_MESSAGES[403]);
  return session;
}

/**
 * Tệp giả trả về khi tải bản sao lưu.
 * @param fileName  tên tệp
 * @returns         response tệp .tar.gz
 */
function fakeArchive(fileName: string) {
  return new HttpResponse(new Blob(['Bản sao lưu giả của API giả.'], { type: 'application/gzip' }), {
    headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}` },
  });
}

export const backupHandlers = [
  // Tổng quan
  http.get(api(ENDPOINTS.backups.overview), async () => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    return HttpResponse.json<BackupsResponse>(getBackupsOverview());
  }),

  // Thêm nơi lưu
  http.post(api(ENDPOINTS.backups.targets), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const parsed = BackupTargetInputSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, BACKUP_MESSAGES[422]);
    const saved = saveBackupTarget(parsed.data);
    if (saved === 'duplicate') return apiError(409, BACKUP_MESSAGES.duplicateTarget);
    if (saved === 'notFound') return apiError(404, BACKUP_MESSAGES.targetNotFound);
    return HttpResponse.json<BackupTarget>(saved, { status: 201 });
  }),

  // Sửa nơi lưu
  http.put(api(ENDPOINTS.backups.target), async ({ request, params }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const parsed = BackupTargetInputSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, BACKUP_MESSAGES[422]);
    const saved = saveBackupTarget(parsed.data, String(params.targetId));
    if (saved === 'duplicate') return apiError(409, BACKUP_MESSAGES.duplicateTarget);
    if (saved === 'notFound') return apiError(404, BACKUP_MESSAGES.targetNotFound);
    return HttpResponse.json<BackupTarget>(saved);
  }),

  // Bỏ nơi lưu
  http.delete(api(ENDPOINTS.backups.target), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    if (!removeBackupTarget(String(params.targetId))) return apiError(404, BACKUP_MESSAGES.targetNotFound);
    return new HttpResponse(null, { status: 204 });
  }),

  // Kết nối Google Drive: API giả coi như Admin đã đồng ý ngay, trả đường dẫn về lại trang Sao lưu
  http.post(api(ENDPOINTS.backups.connectGoogleDrive), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;

    /* JUST FOR DEMO: START · API giả không gọi Google: lấy email người đang đăng nhập làm tài khoản Drive.
       Máy chủ thật trả đường dẫn sang Google, Google gọi về /backups/google-drive/callback. */
    if (!connectBackupDrive(String(params.targetId), session.user.email)) return apiError(404, BACKUP_MESSAGES.targetNotFound);
    return HttpResponse.json<ConnectGoogleDriveResponse>({ url: `${location.origin}/#${PAGE_PATH.backups}` });
    /* JUST FOR DEMO: END */
  }),

  // Lưu lịch
  http.put(api(ENDPOINTS.backups.schedule), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const parsed = BackupScheduleSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, BACKUP_MESSAGES[422]);
    const saved = saveBackupSchedule(parsed.data);
    if (saved === 'unknownTarget') return apiError(422, BACKUP_MESSAGES.unknownScheduleTarget);
    return HttpResponse.json<BackupsResponse>(saved);
  }),

  // Sao lưu ngay vào một nơi lưu
  http.post(api(ENDPOINTS.backups.run), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const parsed = RunBackupRequestSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, BACKUP_MESSAGES[422]);
    const run = startBackupRun(parsed.data.targetId, session.user.id);
    if (run === 'notFound') return apiError(404, BACKUP_MESSAGES.targetNotFound);
    if (run === 'busy') return apiError(409, BACKUP_MESSAGES.busy);
    if (run === 'driveNotConnected') return apiError(409, BACKUP_MESSAGES.driveNotConnected);
    return HttpResponse.json<BackupRun>(run, { status: 202 });
  }),

  // Sao lưu rồi tải về máy
  http.post(api(ENDPOINTS.backups.download), async () => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    if (getBackupsOverview().running) return apiError(409, BACKUP_MESSAGES.busy);
    return fakeArchive(recordBackupDownload(session.user.id));
  }),

  // Tải về một bản đã lưu ở thư mục trên máy chủ
  http.get(api(ENDPOINTS.backups.runFile), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const run = findBackupRun(String(params.runId));
    if (!run) return apiError(404, BACKUP_MESSAGES.runNotFound);
    if (!run.fileAvailable) return apiError(404, BACKUP_MESSAGES.fileGone);
    return fakeArchive(run.fileName);
  }),
];
