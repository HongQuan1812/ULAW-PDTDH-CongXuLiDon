/* API giả: Sao lưu (nơi lưu, sao lưu ngay, lịch định kì, lịch sử). Chỉ vai trò có quyền manageBackups.
   Không sao lưu thật: lần sao lưu tự xong sau vài giây, tệp tải về là tệp giả. */
import { delay, http, HttpResponse } from 'msw';
import {
  BACKUP_MESSAGES,
  BACKUP_RUN_LIST_DEFAULT_SORTING,
  BACKUP_RUN_LIST_FIELDS,
  BackupScheduleSchema,
  BackupTargetInputSchema,
  ConnectGoogleDriveRequestSchema,
  ENDPOINTS,
  COMMON_MESSAGES,
  RunBackupRequestSchema,
  applyListQuery,
  backupRunExtraSearchText,
  can,
  type BackupRun,
  type BackupRunsResponse,
  type BackupTarget,
  type BackupsResponse,
  type ConnectGoogleDriveResponse,
} from '@ulaw/shared';
import {
  createBackupDriveGrant,
  findBackupRun,
  getBackupRuns,
  getBackupsOverview,
  readSession,
  recordBackupDownload,
  removeBackupTarget,
  removeBackupSchedule,
  saveBackupSchedule,
  saveBackupTarget,
  startBackupRuns,
} from '../db';
import { MOCK_DELAY_MS, api, apiError, readListQuery } from '../http';

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

/**
 * Response lỗi khi lưu nơi lưu.
 * @param failure  lí do db trả về
 * @returns        response 404 / 409 / 422
 */
function targetSaveError(failure: 'notFound' | 'duplicate' | 'connectFirst' | 'grantExpired') {
  if (failure === 'notFound') return apiError(404, BACKUP_MESSAGES.targetNotFound);
  if (failure === 'duplicate') return apiError(409, BACKUP_MESSAGES.duplicateTarget);
  return apiError(422, failure === 'connectFirst' ? BACKUP_MESSAGES.driveConnectFirst : BACKUP_MESSAGES.driveGrantExpired);
}

export const backupHandlers = [
  // Tổng quan
  http.get(api(ENDPOINTS.backups.overview), async () => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    return HttpResponse.json<BackupsResponse>(getBackupsOverview());
  }),

  // Một trang lịch sử: tìm, lọc, sắp xếp như các bảng khác
  http.get(api(ENDPOINTS.backups.runs), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const listQuery = readListQuery(request, BACKUP_RUN_LIST_FIELDS);
    if (!listQuery) return apiError(422, COMMON_MESSAGES.listQuery);
    const { rows, ...pageMeta } = applyListQuery(getBackupRuns(), BACKUP_RUN_LIST_FIELDS, listQuery, BACKUP_RUN_LIST_DEFAULT_SORTING, backupRunExtraSearchText);
    return HttpResponse.json<BackupRunsResponse>({ ...pageMeta, runs: rows });
  }),

  // Thêm nơi lưu
  http.post(api(ENDPOINTS.backups.targets), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const parsed = BackupTargetInputSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, BACKUP_MESSAGES[422]);
    const saved = saveBackupTarget(parsed.data, session.user.id);
    if (typeof saved === 'string') return targetSaveError(saved);
    return HttpResponse.json<BackupTarget>(saved, { status: 201 });
  }),

  // Sửa nơi lưu
  http.put(api(ENDPOINTS.backups.target), async ({ request, params }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const parsed = BackupTargetInputSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, BACKUP_MESSAGES[422]);
    const saved = saveBackupTarget(parsed.data, session.user.id, String(params.targetId));
    if (typeof saved === 'string') return targetSaveError(saved);
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

  // Kết nối Google Drive (từ hộp thêm / sửa nơi lưu): API giả trả ngay tài khoản, như bản giả dev-backup-drive của backend
  http.post(api(ENDPOINTS.backups.driveConnect), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const parsed = ConnectGoogleDriveRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return apiError(422, parsed.error.issues[0]?.message ?? BACKUP_MESSAGES[422]);
    const email = parsed.data.email ?? session.user.email;
    return HttpResponse.json<ConnectGoogleDriveResponse>({ kind: 'connected', driveGrantId: createBackupDriveGrant(session.user.id, email), email });
  }),

  // Thêm lịch
  http.post(api(ENDPOINTS.backups.schedules), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const parsed = BackupScheduleSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, parsed.error.issues[0]?.message ?? BACKUP_MESSAGES[422]);
    const saved = saveBackupSchedule(parsed.data);
    if (typeof saved === 'string') return apiError(422, BACKUP_MESSAGES.unknownScheduleTarget);
    return HttpResponse.json<BackupsResponse>(saved, { status: 201 });
  }),

  // Sửa lịch
  http.put(api(ENDPOINTS.backups.schedule), async ({ request, params }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const parsed = BackupScheduleSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, parsed.error.issues[0]?.message ?? BACKUP_MESSAGES[422]);
    const saved = saveBackupSchedule(parsed.data, String(params.scheduleId));
    if (saved === 'notFound') return apiError(404, BACKUP_MESSAGES.scheduleNotFound);
    if (saved === 'unknownTarget') return apiError(422, BACKUP_MESSAGES.unknownScheduleTarget);
    return HttpResponse.json<BackupsResponse>(saved);
  }),

  // Bỏ lịch
  http.delete(api(ENDPOINTS.backups.schedule), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const removed = removeBackupSchedule(String(params.scheduleId));
    if (removed === 'notFound') return apiError(404, BACKUP_MESSAGES.scheduleNotFound);
    return HttpResponse.json<BackupsResponse>(removed);
  }),

  // Sao lưu ngay vào các nơi đã chọn
  http.post(api(ENDPOINTS.backups.run), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await backupSession();
    if (session instanceof Response) return session;
    const parsed = RunBackupRequestSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(422, parsed.error.issues[0]?.message ?? BACKUP_MESSAGES[422]);
    const runs = startBackupRuns(parsed.data.targetIds, session.user.id);
    if (runs === 'notFound') return apiError(404, BACKUP_MESSAGES.targetNotFound);
    if (runs === 'busy') return apiError(409, BACKUP_MESSAGES.busy);
    if (runs === 'driveNotConnected') return apiError(409, BACKUP_MESSAGES.driveNotConnected);
    return HttpResponse.json<BackupRun[]>(runs, { status: 202 });
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
