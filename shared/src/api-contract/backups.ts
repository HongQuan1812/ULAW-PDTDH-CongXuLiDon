/* HỢP ĐỒNG nhóm API Sao lưu (chỉ vai trò có quyền manageBackups): nơi lưu, sao lưu ngay, lịch định kì, lịch sử.
   Mỗi bản sao lưu luôn gồm cả database lẫn tệp tải lên, đóng thành một tệp sao-luu-<YYYYMMDD-HHmmss>.tar.gz.
   Nơi lưu: thư mục trên máy chủ (nằm trong BACKUP_DIR) hoặc Google Drive (tài khoản Google Admin kết nối).
   Tải về máy Admin không phải nơi lưu: chỉ có khi sao lưu ngay, máy chủ tạo bản rồi trả thẳng về trình duyệt.
   Khôi phục: chưa làm.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import { StaffRefSchema } from './form';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const BACKUP_ENDPOINTS = {
  /** GET → BackupsResponse: nơi lưu, lịch, lịch sử, đang chạy không */
  overview: '/backups',
  /** POST BackupTargetInput → BackupTarget: thêm nơi lưu */
  targets: '/backups/targets',
  /** PUT BackupTargetInput → BackupTarget: sửa nơi lưu · DELETE → 204: bỏ nơi lưu (bản đã lưu ở đó không bị xóa) */
  target: '/backups/targets/:targetId',
  /** POST → ConnectGoogleDriveResponse: đường dẫn sang Google để kết nối tài khoản Drive cho nơi lưu kiểu googleDrive.
      Google trả về /backups/google-drive/callback, máy chủ lưu quyền rồi chuyển về trang Sao lưu (kèm ?driveError=… nếu lỗi) */
  connectGoogleDrive: '/backups/targets/:targetId/google-drive',
  /** GET (Google gọi về sau khi Admin đồng ý), không gọi từ giao diện */
  googleDriveCallback: '/backups/google-drive/callback',
  /** PUT BackupSchedule → BackupsResponse: lưu lịch định kì */
  schedule: '/backups/schedule',
  /** POST RunBackupRequest → BackupRun (status 'running'): bắt đầu sao lưu vào một nơi lưu, chạy nền; giao diện tải lại GET /backups tới khi xong */
  run: '/backups/run',
  /** POST → tệp .tar.gz: sao lưu rồi tải thẳng về (không giữ trên máy chủ), có ghi vào lịch sử */
  download: '/backups/download',
  /** GET → tệp .tar.gz: tải về một bản đã lưu ở thư mục trên máy chủ (fileAvailable = true) */
  runFile: '/backups/runs/:runId/file',
} as const;

/**
 * Đường dẫn API của một nơi lưu.
 * @param targetId  id nơi lưu
 * @returns         vd '/backups/targets/backup-target-server'
 */
export function backupTargetPath(targetId: string): string {
  return BACKUP_ENDPOINTS.target.replace(':targetId', encodeURIComponent(targetId));
}

/**
 * Đường dẫn API kết nối Google Drive cho một nơi lưu.
 * @param targetId  id nơi lưu kiểu googleDrive
 * @returns         vd '/backups/targets/backup-target-1/google-drive'
 */
export function connectGoogleDrivePath(targetId: string): string {
  return BACKUP_ENDPOINTS.connectGoogleDrive.replace(':targetId', encodeURIComponent(targetId));
}

/**
 * Đường dẫn API tải về một bản đã lưu.
 * @param runId  id lần sao lưu
 * @returns      vd '/backups/runs/backup-run-1/file'
 */
export function backupRunFilePath(runId: string): string {
  return BACKUP_ENDPOINTS.runFile.replace(':runId', encodeURIComponent(runId));
}

/* ---------- Nơi lưu ---------- */

export const BACKUP_TARGET_KINDS = ['serverFolder', 'googleDrive'] as const;
export type BackupTargetKind = (typeof BACKUP_TARGET_KINDS)[number];

/** Tên kiểu nơi lưu hiện trên giao diện. */
export const BACKUP_TARGET_KIND_LABEL: Record<BackupTargetKind, string> = {
  serverFolder: 'Thư mục trên máy chủ',
  googleDrive: 'Google Drive',
};

/** Thư mục con trong BACKUP_DIR: chữ không dấu, số, - _, các cấp cách nhau bằng /; không có .. nên không ra ngoài BACKUP_DIR. */
const SERVER_FOLDER_PATTERN = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

/** Số bản giữ lại nhiều nhất ở một nơi lưu. */
export const BACKUP_KEEP_MAX = 365;

/** Body của POST /backups/targets, PUT /backups/targets/:id. */
export const BackupTargetInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Nhập tên nơi lưu.').max(100),
    kind: z.enum(BACKUP_TARGET_KINDS),
    /** serverFolder: thư mục con trong BACKUP_DIR, vd 'hang-ngay' · googleDrive: tên thư mục trên Drive, máy chủ tự tạo nếu chưa có */
    folder: z.string().trim().min(1, 'Nhập thư mục.').max(200),
    /** giữ bao nhiêu bản gần nhất ở nơi này (bản cũ hơn tự xóa sau mỗi lần sao lưu thành công) */
    keepLatest: z.number().int().min(1, 'Giữ ít nhất 1 bản.').max(BACKUP_KEEP_MAX, `Giữ nhiều nhất ${BACKUP_KEEP_MAX} bản.`),
  })
  .refine((target) => target.kind !== 'serverFolder' || SERVER_FOLDER_PATTERN.test(target.folder), {
    path: ['folder'],
    message: 'Thư mục chỉ gồm chữ không dấu, số, dấu - và _, các cấp cách nhau bằng /.',
  });
export type BackupTargetInput = z.infer<typeof BackupTargetInputSchema>;

/** Một nơi lưu. */
export const BackupTargetSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(BACKUP_TARGET_KINDS),
  folder: z.string(),
  keepLatest: z.number().int(),
  /** googleDrive: email tài khoản Google đã kết nối; null = chưa kết nối (chưa lưu được). serverFolder: luôn null */
  googleAccount: z.string().nullable(),
  /** số bản đang có ở nơi này (theo lịch sử, chưa bị xóa) */
  backupCount: z.number().int(),
});
export type BackupTarget = z.infer<typeof BackupTargetSchema>;

/** Tên tham số mang lỗi kết nối Drive khi máy chủ chuyển về trang Sao lưu, vd #/sao-luu?driveError=denied */
export const DRIVE_ERROR_PARAM = 'driveError';
export const DRIVE_ERRORS = ['denied', 'failed'] as const;
export type DriveError = (typeof DRIVE_ERRORS)[number];

/** Trả về từ POST /backups/targets/:id/google-drive. */
export const ConnectGoogleDriveResponseSchema = z.object({ url: z.url() });
export type ConnectGoogleDriveResponse = z.infer<typeof ConnectGoogleDriveResponseSchema>;

/* ---------- Lịch định kì ---------- */

export const BACKUP_FREQUENCIES = ['daily', 'weekly'] as const;
export type BackupFrequency = (typeof BACKUP_FREQUENCIES)[number];

/** Tên thứ trong tuần, 1 = Thứ Hai … 7 = Chủ nhật. */
export const WEEKDAY_LABEL: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ nhật',
};

/** Lịch định kì. Body của PUT /backups/schedule. Giờ theo giờ Việt Nam. */
export const BackupScheduleSchema = z
  .object({
    enabled: z.boolean(),
    frequency: z.enum(BACKUP_FREQUENCIES),
    /** weekly: thứ mấy, 1 = Thứ Hai … 7 = Chủ nhật (daily bỏ qua) */
    weekday: z.number().int().min(1).max(7),
    /** giờ chạy 'HH:mm' */
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ chạy dạng HH:mm.'),
    /** lưu vào các nơi nào (id nơi lưu) */
    targetIds: z.array(z.string()),
  })
  .refine((schedule) => !schedule.enabled || schedule.targetIds.length > 0, {
    path: ['targetIds'],
    message: 'Chọn ít nhất một nơi lưu.',
  });
export type BackupSchedule = z.infer<typeof BackupScheduleSchema>;

/* ---------- Lịch sử ---------- */

export const BACKUP_RUN_STATUSES = ['running', 'ok', 'error'] as const;
export type BackupRunStatus = (typeof BACKUP_RUN_STATUSES)[number];

/** Một lần sao lưu vào một nơi lưu (lịch định kì lưu vào nhiều nơi thì mỗi nơi một dòng). */
export const BackupRunSchema = z.object({
  id: z.string(),
  /** giờ Việt Nam 'YYYY-MM-DDTHH:mm:ss' */
  startedAt: z.string(),
  /** null = đang chạy */
  finishedAt: z.string().nullable(),
  /** manual = Admin bấm, scheduled = lịch định kì */
  trigger: z.enum(['manual', 'scheduled']),
  /** người bấm; null khi chạy theo lịch */
  startedBy: StaffRefSchema.nullable(),
  /** nơi lưu lúc chạy: tên và kiểu chép lại (nơi lưu bị sửa, bỏ sau đó vẫn đọc được); 'download' = tải về máy */
  targetName: z.string(),
  targetKind: z.enum([...BACKUP_TARGET_KINDS, 'download']),
  fileName: z.string(),
  /** dung lượng tệp, byte; null khi chưa xong hoặc lỗi */
  sizeBytes: z.number().int().nullable(),
  status: z.enum(BACKUP_RUN_STATUSES),
  /** câu lỗi khi status = 'error' */
  error: z.string().nullable(),
  /** còn tệp ở thư mục máy chủ để tải về không (bản ở Drive, bản đã tải về, bản đã bị xóa vì quá số bản giữ lại: false) */
  fileAvailable: z.boolean(),
  /** bản này đã bị xóa khỏi nơi lưu vì quá số bản giữ lại */
  pruned: z.boolean(),
});
export type BackupRun = z.infer<typeof BackupRunSchema>;

/** Body của POST /backups/run. */
export const RunBackupRequestSchema = z.object({ targetId: z.string().min(1, 'Chọn nơi lưu.') });
export type RunBackupRequest = z.infer<typeof RunBackupRequestSchema>;

/** Số dòng lịch sử gần nhất trả về. */
export const BACKUP_RUNS_LIMIT = 100;

/** Trả về từ GET /backups, PUT /backups/schedule. */
export const BackupsResponseSchema = z.object({
  targets: z.array(BackupTargetSchema),
  schedule: BackupScheduleSchema,
  /** lần chạy định kì tới, giờ Việt Nam 'YYYY-MM-DDTHH:mm'; null khi lịch đang tắt */
  nextScheduledAt: z.string().nullable(),
  /** lần sao lưu thành công gần nhất (mọi nơi lưu), giờ Việt Nam 'YYYY-MM-DDTHH:mm:ss'; null = chưa có */
  lastSuccessAt: z.string().nullable(),
  /** đang có bản sao lưu chạy (mỗi lúc chỉ một bản) */
  running: z.boolean(),
  /** máy chủ đã có OAuth client Google chưa (chưa thì không kết nối được Drive) */
  googleDriveAvailable: z.boolean(),
  /** lịch sử, mới nhất trước, nhiều nhất BACKUP_RUNS_LIMIT dòng */
  runs: z.array(BackupRunSchema),
});
export type BackupsResponse = z.infer<typeof BackupsResponseSchema>;

/* ---------- Câu thông báo ---------- */

export const BACKUP_MESSAGES = {
  targetAdded: 'Đã thêm nơi lưu',
  targetSaved: 'Đã lưu nơi lưu',
  targetRemoved: 'Đã bỏ nơi lưu',
  scheduleSaved: 'Đã lưu lịch sao lưu',
  /** POST /backups/run */
  started: (targetName: string) => `Đang sao lưu vào “${targetName}”…`,
  401: 'Bạn chưa đăng nhập.',
  /** Mọi API của nhóm khi không có quyền manageBackups */
  403: 'Bạn không có quyền sao lưu.',
  /** Không có nơi lưu, bản sao lưu (404) */
  targetNotFound: 'Không tìm thấy nơi lưu này.',
  runNotFound: 'Không tìm thấy bản sao lưu này.',
  /** Tệp của bản sao lưu không còn ở máy chủ (404) */
  fileGone: 'Tệp của bản sao lưu này không còn trên máy chủ.',
  /** Đang có bản khác chạy (409) */
  busy: 'Đang có một bản sao lưu chạy, chờ xong rồi thử lại.',
  /** Hai nơi lưu cùng kiểu cùng thư mục (409) */
  duplicateTarget: 'Đã có nơi lưu dùng thư mục này.',
  /** Lịch chọn nơi lưu không có (422) */
  unknownScheduleTarget: 'Lịch sao lưu chọn một nơi lưu không còn nữa.',
  /** Nơi lưu Drive chưa kết nối tài khoản Google (409) */
  driveNotConnected: 'Nơi lưu này chưa kết nối tài khoản Google Drive.',
  /** Máy chủ chưa có OAuth client Google (503) */
  driveUnavailable: 'Máy chủ chưa cấu hình Google (GOOGLE_CLIENT_ID), chưa kết nối được Drive.',
  /** Lỗi khi kết nối Drive, theo ?driveError=… */
  driveError: {
    denied: 'Bạn chưa đồng ý cho cổng lưu vào Google Drive.',
    failed: 'Không kết nối được Google Drive, thử lại.',
  },
  422: 'Thông tin chưa hợp lệ.',
} as const;
