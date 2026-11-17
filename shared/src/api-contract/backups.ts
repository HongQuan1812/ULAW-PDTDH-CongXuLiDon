/* HỢP ĐỒNG nhóm API Sao lưu (chỉ vai trò có quyền manageBackups): nơi lưu, sao lưu ngay, lịch định kì, lịch sử.
   Mỗi bản sao lưu luôn gồm cả database lẫn tệp tải lên, đóng thành một tệp sao-luu-<YYYYMMDD-HHmmss>.tar.gz.
   Nơi lưu: thư mục trên máy chủ (nằm trong BACKUP_DIR) hoặc Google Drive (tài khoản Google Admin kết nối ngay trong hộp thêm / sửa nơi lưu, trước khi Lưu;
   thư mục chọn bằng Google Picker: thư mục Admin chọn được cấp cho cổng, nên cổng lưu thẳng vào thư mục có sẵn mà vẫn chỉ xin quyền drive.file).
   Tải về máy Admin không phải nơi lưu: chỉ có khi sao lưu ngay (chọn riêng, không đi cùng nơi lưu nào), máy chủ tạo bản rồi trả thẳng về trình duyệt.
   Khôi phục: chưa làm.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import type { ListSortRule } from '../aux-schema/lists';
import type { TableField } from '../business-rules/lists--query';
import { ListPageMetaSchema } from './common';
import { StaffRefSchema } from './form';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const BACKUP_ENDPOINTS = {
  /** GET → BackupsResponse: nơi lưu, lịch, lần gần nhất, lần tới, đang chạy không */
  overview: '/backups',
  /** POST BackupTargetInput → BackupTarget: thêm nơi lưu */
  targets: '/backups/targets',
  /** PUT BackupTargetInput → BackupTarget: sửa nơi lưu · DELETE → 204: bỏ nơi lưu (bản đã lưu ở đó không bị xóa) */
  target: '/backups/targets/:targetId',
  /** POST ConnectGoogleDriveRequest → ConnectGoogleDriveResponse: kết nối một tài khoản Google Drive (gọi từ hộp thêm / sửa nơi lưu, trước khi Lưu).
      Kết nối xong có driveGrantId (dùng một lần, có hạn) và email; bấm Lưu thì gửi driveGrantId kèm nơi lưu.
      Bản giả (dev-google-drive-connect): trả ngay 'connected' với email gửi kèm. Bản thật: trả 'redirect', giao diện mở đường dẫn
      trong cửa sổ popup sang Google; Google gọi về /backups/google-drive/callback, trang đó gửi DriveConnectMessage cho hộp thoại rồi tự đóng */
  driveConnect: '/backups/google-drive/connect',
  /** GET (Google gọi về sau khi Admin đồng ý), không gọi từ giao diện */
  googleDriveCallback: '/backups/google-drive/callback',
  /** POST DrivePickerRequest → DrivePickerResponse: mở Google Picker để chọn thư mục Drive cho nơi lưu (tài khoản vừa kết nối hoặc tài khoản của nơi lưu đang sửa).
      Bản thật: trả access token ngắn hạn (quyền drive.file) của tài khoản đó, API key và appId cho Picker.
      Tài khoản kết nối bằng bản giả (dev-google-drive-connect): trả 'demo', giao diện cho gõ tên thư mục thay cho Picker */
  drivePicker: '/backups/google-drive/picker',
  /** POST BackupSchedule → BackupsResponse: thêm một lịch định kì */
  schedules: '/backups/schedules',
  /** PUT BackupSchedule → BackupsResponse: sửa một lịch · DELETE → BackupsResponse: bỏ một lịch */
  schedule: '/backups/schedules/:scheduleId',
  /** POST RunBackupRequest → BackupRun[] (status 'running', mỗi nơi một dòng): tạo một bản rồi lưu vào các nơi đã chọn, chạy nền;
      giao diện tải lại GET /backups tới khi xong */
  run: '/backups/run',
  /** GET ?<một trang> (xem listQueryParams() ở common.ts) → BackupRunsResponse: một trang lịch sử, cột theo BACKUP_RUN_LIST_FIELDS */
  runs: '/backups/runs',
  /** POST → tệp .tar.gz: sao lưu rồi tải thẳng về (không giữ trên máy chủ). Lịch sử: 'running' từ lúc bấm,
      'ok' khi trình duyệt nhận đủ tệp, 'error' khi tạo lỗi hoặc đường truyền đứt giữa chừng */
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
 * Đường dẫn API của một lịch định kì.
 * @param scheduleId  id lịch
 * @returns           vd '/backups/schedules/backup-schedule-daily'
 */
export function backupSchedulePath(scheduleId: string): string {
  return BACKUP_ENDPOINTS.schedule.replace(':scheduleId', encodeURIComponent(scheduleId));
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
    /** serverFolder: thư mục con trong BACKUP_DIR, vd 'hang-ngay' (bắt buộc) · googleDrive: tên chỗ lưu đã chọn
        (để hiện; bản thật máy chủ lấy lại tên trên Drive) */
    folder: z.string().trim().max(200),
    /** googleDrive: chỗ lưu trên Drive (bắt buộc): DRIVE_ROOT_FOLDER_ID = My Drive, hoặc id thư mục chọn bằng Picker. serverFolder: bỏ qua */
    driveFolderId: z.string().min(1).optional(),
    /** googleDrive: tên thư mục mới, bấm Lưu thì máy chủ tạo thư mục này bên trong chỗ lưu rồi lưu vào đó (Picker không tạo được thư mục);
        trống = lưu thẳng vào chỗ lưu. serverFolder: bỏ qua */
    newDriveFolderName: z.string().trim().max(100, 'Tên thư mục dài quá 100 kí tự.').optional(),
    /** giữ bao nhiêu bản gần nhất ở nơi này (bản cũ hơn tự xóa sau mỗi lần sao lưu thành công) */
    keepLatest: z.number().int().min(1, 'Giữ ít nhất 1 bản.').max(BACKUP_KEEP_MAX, `Giữ nhiều nhất ${BACKUP_KEEP_MAX} bản.`),
    /** googleDrive: tài khoản vừa kết nối (POST /backups/google-drive/connect). Thêm mới, hoặc đổi sang kiểu Drive thì bắt buộc;
        sửa nơi Drive đã có tài khoản thì bỏ trống = giữ tài khoản cũ. serverFolder: bỏ qua */
    driveGrantId: z.string().min(1).optional(),
  })
  .refine((target) => target.kind !== 'serverFolder' || target.folder !== '', { path: ['folder'], message: 'Nhập thư mục.' })
  .refine((target) => target.kind !== 'googleDrive' || !!target.driveFolderId, { path: ['driveFolderId'], message: 'Chọn chỗ lưu trên Drive.' })
  .refine((target) => target.kind !== 'serverFolder' || target.folder === '' || SERVER_FOLDER_PATTERN.test(target.folder), {
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
  /** googleDrive: id thư mục đã chọn trên Drive; null = chưa chọn. serverFolder: luôn null */
  driveFolderId: z.string().nullable(),
  /** googleDrive: đường dẫn mở thư mục trên Drive; null = chưa chọn thư mục. serverFolder: luôn null */
  driveFolderUrl: z.string().nullable(),
  /** số bản đang có ở nơi này (theo lịch sử, chưa bị xóa) */
  backupCount: z.number().int(),
});
export type BackupTarget = z.infer<typeof BackupTargetSchema>;

/** Lỗi khi kết nối Drive: denied = bấm Hủy ở Google, failed = hết hạn, sai state, Google từ chối. */
export const DRIVE_ERRORS = ['denied', 'failed'] as const;
export type DriveError = (typeof DRIVE_ERRORS)[number];

/** Body của POST /backups/google-drive/connect. */
export const ConnectGoogleDriveRequestSchema = z.object({
  /** Chỉ bản giả: email giả làm tài khoản Google (bỏ trống = email người đang đăng nhập). Bản thật bỏ qua, tài khoản do Google trả về */
  email: z.string().trim().toLowerCase().pipe(z.email('Email chưa đúng định dạng.')).optional(),
});
export type ConnectGoogleDriveRequest = z.infer<typeof ConnectGoogleDriveRequestSchema>;

/** Trả về từ POST /backups/google-drive/connect: đã kết nối (bản giả), hoặc đường dẫn sang Google để mở trong popup (bản thật). */
export const ConnectGoogleDriveResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('connected'),
    driveGrantId: z.string(),
    email: z.string(),
  }),
  z.object({ kind: z.literal('redirect'), url: z.url() }),
]);
export type ConnectGoogleDriveResponse = z.infer<typeof ConnectGoogleDriveResponseSchema>;

/** Kết nối Drive xong hoặc lỗi (bản thật): trang callback trong popup gửi tin DriveConnectMessage cho cửa sổ mở nó rồi tự đóng.
    Gửi hai đường: postMessage cho window.opener, và BroadcastChannel DRIVE_CONNECT_CHANNEL (phòng khi trình duyệt cắt opener sau khi qua trang Google). */
export const DRIVE_CONNECT_MESSAGE_TYPE = 'ulaw-backup-drive-connect';
export const DRIVE_CONNECT_CHANNEL = 'ulaw-backup-drive-connect';

/** Tin trang callback gửi về: kết nối được (driveGrantId, email) hoặc lỗi. */
export const DriveConnectMessageSchema = z.discriminatedUnion('ok', [
  z.object({ type: z.literal(DRIVE_CONNECT_MESSAGE_TYPE), ok: z.literal(true), driveGrantId: z.string().min(1), email: z.string().min(1) }),
  z.object({ type: z.literal(DRIVE_CONNECT_MESSAGE_TYPE), ok: z.literal(false), error: z.enum(DRIVE_ERRORS) }),
]);
export type DriveConnectMessage = z.infer<typeof DriveConnectMessageSchema>;

/** Body của POST /backups/google-drive/picker: tài khoản nào (đúng một trong hai). */
export const DrivePickerRequestSchema = z
  .object({
    /** tài khoản vừa kết nối trong hộp thoại, chưa Lưu (không làm mất driveGrantId) */
    driveGrantId: z.string().min(1).optional(),
    /** tài khoản của nơi lưu Drive đang sửa */
    targetId: z.string().min(1).optional(),
  })
  .refine((pickerRequest) => !!pickerRequest.driveGrantId !== !!pickerRequest.targetId, 'Kết nối tài khoản Google trước khi chọn thư mục.');
export type DrivePickerRequest = z.infer<typeof DrivePickerRequestSchema>;

/** id đặc biệt của My Drive (thư mục gốc) trên Google Drive. */
export const DRIVE_ROOT_FOLDER_ID = 'root';
/** Tên hiện của My Drive. */
export const DRIVE_ROOT_FOLDER_NAME = 'My Drive';

/** Trả về từ POST /backups/google-drive/picker. */
export const DrivePickerResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('picker'),
    /** access token ngắn hạn (khoảng 1 giờ), quyền drive.file, của tài khoản đã kết nối */
    accessToken: z.string(),
    /** API key của Google Cloud project (GOOGLE_PICKER_API_KEY) */
    apiKey: z.string(),
    /** số hiệu project (phần đầu của GOOGLE_CLIENT_ID): Picker cần để cấp thư mục đã chọn cho cổng */
    appId: z.string(),
  }),
  /** tài khoản kết nối bằng bản giả: không có quyền Google thật, giao diện cho gõ tên thư mục */
  z.object({ kind: z.literal('demo') }),
]);
export type DrivePickerResponse = z.infer<typeof DrivePickerResponseSchema>;

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

/* Có thể có nhiều lịch (vd hằng ngày 02:00 vào ổ máy chủ, Chủ nhật 23:00 lên Drive). Nhiều lịch trúng cùng một phút
   thì chạy chung một lần: một tệp, lưu vào mọi nơi của các lịch đó. */

/** Các ô của một lịch định kì. Giờ theo giờ Việt Nam. */
const backupScheduleFields = z.object({
  enabled: z.boolean(),
  frequency: z.enum(BACKUP_FREQUENCIES),
  /** weekly: thứ mấy, 1 = Thứ Hai … 7 = Chủ nhật (daily bỏ qua) */
  weekday: z.number().int().min(1).max(7),
  /** giờ chạy 'HH:mm' */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ chạy dạng HH:mm.'),
  /** lưu vào các nơi nào (id nơi lưu) */
  targetIds: z.array(z.string()),
});

/** Một lịch định kì. Body của POST /backups/schedules, PUT /backups/schedules/:id. */
export const BackupScheduleSchema = backupScheduleFields.refine((schedule) => !schedule.enabled || schedule.targetIds.length > 0, {
  path: ['targetIds'],
  message: 'Chọn ít nhất một nơi lưu.',
});
export type BackupSchedule = z.infer<typeof BackupScheduleSchema>;

/** Một lịch định kì đã lưu (có id). */
export const BackupScheduleItemSchema = backupScheduleFields.extend({
  id: z.string(),
});
export type BackupScheduleItem = z.infer<typeof BackupScheduleItemSchema>;

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
  /** bản còn trên Google Drive: đường dẫn mở tệp trên Drive · bản ở nơi khác, lỗi, đã bị xóa vì quá số bản giữ lại: null */
  driveFileUrl: z.string().nullable(),
  /** bản này đã bị xóa khỏi nơi lưu vì quá số bản giữ lại */
  pruned: z.boolean(),
});
export type BackupRun = z.infer<typeof BackupRunSchema>;

/** Body của POST /backups/run: lưu vào các nơi nào (ít nhất một, không trùng). */
export const RunBackupRequestSchema = z.object({
  targetIds: z
    .array(z.string().min(1))
    .min(1, 'Chọn ít nhất một nơi lưu.')
    .refine((targetIds) => new Set(targetIds).size === targetIds.length, 'Mỗi nơi lưu chỉ chọn một lần.'),
});
export type RunBackupRequest = z.infer<typeof RunBackupRequestSchema>;

/** Tên kiểu nơi lưu ở bảng lịch sử (thêm 'download' = tải về máy). */
export const BACKUP_RUN_KIND_LABEL: Record<BackupRun['targetKind'], string> = {
  ...BACKUP_TARGET_KIND_LABEL,
  download: 'Tải về máy',
};

/** Tình trạng ở bảng lịch sử: ba tình trạng của BACKUP_RUN_STATUSES, thêm 'pruned' = thành công nhưng đã xóa vì quá số bản giữ lại. */
export const BACKUP_RUN_STATUS_LABEL = {
  running: 'Đang chạy',
  ok: 'Thành công',
  error: 'Lỗi',
  pruned: 'Đã xóa · quá số bản giữ',
} as const;
export type BackupRunStatusView = keyof typeof BACKUP_RUN_STATUS_LABEL;

/**
 * Tình trạng một lần sao lưu hiện ở bảng lịch sử.
 * @param run  lần sao lưu
 * @returns    'running' | 'ok' | 'error' | 'pruned'
 */
export function backupRunStatusView(run: Pick<BackupRun, 'status' | 'pruned'>): BackupRunStatusView {
  return run.status === 'ok' && run.pruned ? 'pruned' : run.status;
}

/** Cách chạy ở bảng lịch sử. */
const BACKUP_TRIGGER_LABEL = {
  manual: 'Bấm tay',
  scheduled: 'Định kì',
} as const;

/** Các cột của bảng lịch sử (tìm, lọc, sắp xếp). Tìm kiếm còn tìm được câu lỗi. */
export const BACKUP_RUN_LIST_FIELDS: TableField<BackupRun>[] = [
  {
    key: 'startedAt',
    label: 'Lúc',
    type: 'datetime',
    getValue: (run) => run.startedAt,
  },
  {
    key: 'trigger',
    label: 'Cách chạy',
    type: 'select',
    getValue: (run) => run.trigger,
    // Bấm tay thì kèm tên người bấm, để tìm được theo tên
    getLabel: (run) => (run.trigger === 'manual' && run.startedBy ? `${BACKUP_TRIGGER_LABEL.manual} · ${run.startedBy.name}` : BACKUP_TRIGGER_LABEL[run.trigger]),
    options: Object.entries(BACKUP_TRIGGER_LABEL).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    key: 'targetName',
    label: 'Lưu vào',
    type: 'text',
    getValue: (run) => run.targetName,
  },
  {
    key: 'targetKind',
    label: 'Kiểu nơi lưu',
    type: 'select',
    getValue: (run) => run.targetKind,
    getLabel: (run) => BACKUP_RUN_KIND_LABEL[run.targetKind],
    options: Object.entries(BACKUP_RUN_KIND_LABEL).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    key: 'sizeMB',
    label: 'Dung lượng (MB)',
    type: 'number',
    getValue: (run) => (run.sizeBytes === null ? null : Math.round((run.sizeBytes / (1024 * 1024)) * 10) / 10),
  },
  {
    key: 'status',
    label: 'Tình trạng',
    type: 'select',
    getValue: backupRunStatusView,
    getLabel: (run) => BACKUP_RUN_STATUS_LABEL[backupRunStatusView(run)],
    options: Object.entries(BACKUP_RUN_STATUS_LABEL).map(([value, label]) => ({
      value,
      label,
    })),
    getOrder: (run) => Object.keys(BACKUP_RUN_STATUS_LABEL).indexOf(backupRunStatusView(run)),
  },
];

/** Thứ tự bảng lịch sử khi chưa chọn sắp xếp: mới nhất trước. */
export const BACKUP_RUN_LIST_DEFAULT_SORTING: ListSortRule[] = [{ id: 'startedAt', desc: true }];

/**
 * Chữ tìm được dù không hiện thành cột: câu lỗi.
 * @param run  lần sao lưu
 * @returns    các chữ thêm cho tìm kiếm
 */
export function backupRunExtraSearchText(run: BackupRun): string[] {
  return run.error ? [run.error] : [];
}

/** Trả về từ GET /backups/runs: một trang lịch sử, kèm tổng số dòng khớp. */
export const BackupRunsResponseSchema = ListPageMetaSchema.extend({
  runs: z.array(BackupRunSchema),
});
export type BackupRunsResponse = z.infer<typeof BackupRunsResponseSchema>;

/** Trả về từ GET /backups và các lệnh thêm / sửa / bỏ lịch. */
export const BackupsResponseSchema = z.object({
  targets: z.array(BackupTargetSchema),
  /** các lịch định kì, theo thứ tự thêm */
  schedules: z.array(BackupScheduleItemSchema),
  /** lần chạy định kì tới (sớm nhất trong các lịch đang bật), giờ Việt Nam 'YYYY-MM-DDTHH:mm'; null khi không lịch nào bật */
  nextScheduledAt: z.string().nullable(),
  /** lần sao lưu thành công gần nhất (mọi nơi lưu), giờ Việt Nam 'YYYY-MM-DDTHH:mm:ss'; null = chưa có */
  lastSuccessAt: z.string().nullable(),
  /** đang có bản sao lưu chạy (mỗi lúc chỉ một bản) */
  running: z.boolean(),
  /** máy chủ đã có OAuth client Google chưa (chưa thì không kết nối được Drive) */
  googleDriveAvailable: z.boolean(),
});
export type BackupsResponse = z.infer<typeof BackupsResponseSchema>;

/* ---------- Câu thông báo ---------- */

export const BACKUP_MESSAGES = {
  targetAdded: 'Đã thêm nơi lưu',
  targetSaved: 'Đã lưu nơi lưu',
  targetRemoved: 'Đã bỏ nơi lưu',
  scheduleAdded: 'Đã thêm lịch sao lưu',
  scheduleSaved: 'Đã lưu lịch sao lưu',
  scheduleRemoved: 'Đã bỏ lịch sao lưu',
  /** Không có lịch này (404) */
  scheduleNotFound: 'Không tìm thấy lịch sao lưu này.',
  /** POST /backups/run */
  started: (targetCount: number) => `Đang sao lưu vào ${targetCount} nơi…`,
  401: 'Bạn chưa đăng nhập.',
  /** Mọi API của nhóm khi không có quyền manageBackups */
  403: 'Bạn không có quyền sao lưu.',
  /** Không có nơi lưu, bản sao lưu (404) */
  targetNotFound: 'Không tìm thấy nơi lưu này.',
  runNotFound: 'Không tìm thấy bản sao lưu này.',
  /** Tải về máy: trình duyệt ngắt khi chưa nhận đủ tệp (ghi vào lịch sử) */
  downloadAborted: 'Trình duyệt ngắt khi đang tải về, tệp chưa tải xong.',
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
  /** Lưu nơi lưu Drive mà chưa kết nối tài khoản (422) */
  driveConnectFirst: 'Bấm “Kết nối Google” để chọn tài khoản trước khi lưu.',
  /** Lưu nơi lưu Drive mà cổng không mở được thư mục đã chọn: không phải thư mục, đã xóa, hoặc chọn bằng tài khoản khác (422) */
  driveFolderInvalid: 'Cổng không mở được thư mục này trên Drive, bấm “Chọn…” để chọn lại.',
  /** Máy chủ chưa có API key cho Google Picker (503) */
  pickerUnavailable: 'Máy chủ chưa cấu hình GOOGLE_PICKER_API_KEY, chưa chọn được thư mục Drive.',
  /** Không tải được Google Picker trong trình duyệt */
  pickerLoadFailed: 'Không mở được cửa sổ chọn thư mục của Google, thử lại.',
  /** driveGrantId không còn dùng được: quá hạn, đã dùng, của người khác, hoặc backend vừa khởi động lại (422) */
  driveGrantExpired: 'Kết nối Google đã hết hạn, bấm Kết nối lại.',
  /** Kết nối xong, hiện ở hộp thoại */
  driveConnected: (email: string) => `Đã kết nối ${email}. Bấm Lưu để lưu nơi lưu.`,
  /** Máy chủ chưa có OAuth client Google (503) */
  driveUnavailable: 'Máy chủ chưa cấu hình Google (GOOGLE_CLIENT_ID), chưa kết nối được Drive.',
  /** Lỗi khi kết nối Drive (tin từ trang callback trong popup) */
  driveError: {
    denied: 'Bạn chưa đồng ý cho cổng lưu vào Google Drive.',
    failed: 'Không kết nối được Google Drive, thử lại.',
  },
  422: 'Thông tin chưa hợp lệ.',
} as const;
