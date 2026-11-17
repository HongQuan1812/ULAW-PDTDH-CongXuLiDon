/* Sao lưu: nơi lưu, lịch định kì, lịch sử, chạy sao lưu (tay hoặc theo lịch), giữ N bản gần nhất ở mỗi nơi lưu.
   Mỗi lúc chỉ chạy một lần sao lưu (một tệp, lưu vào một hoặc nhiều nơi). Lịch: kiểm mỗi 30 giây, tới phút chạy thì chạy;
   backend tắt đúng phút đó thì lần ấy bỏ qua. Bật backend: lần sao lưu còn 'running' (backend tắt giữa chừng) ghi thành lỗi.
   Quyền manageBackups đã được guard kiểm tra ở controller. */
import { createReadStream, existsSync } from 'node:fs';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  BACKUP_MESSAGES,
  DRIVE_ROOT_FOLDER_ID,
  DRIVE_ROOT_FOLDER_NAME,
  BACKUP_RUN_LIST_DEFAULT_SORTING,
  BACKUP_RUN_LIST_FIELDS,
  applyListQuery,
  backupFileName,
  backupRunExtraSearchText,
  isScheduledMinute,
  nextScheduledAtOf,
  type BackupRun,
  type BackupRunsResponse,
  type BackupSchedule,
  type BackupScheduleItem,
  type BackupTarget,
  type BackupTargetInput,
  type BackupsResponse,
  type DrivePickerRequest,
  type DrivePickerResponse,
  type ListQuery,
} from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import { fromVietnamTime, toVietnamSeconds, toVietnamTime } from '../common/vietnam-time';
import { AppConfig } from '../config/app-config';
import type { Prisma, User } from '../generated/prisma/client';
import { createBackupArchive } from './backup-archive';
import { GoogleDriveBackupService, accountOf, driveFolderUrlOf, type DriveGrant } from './google-drive-backup.service';

/** Bao lâu kiểm lịch một lần, mili giây (nhỏ hơn một phút để không lỡ phút nào). */
const SCHEDULE_CHECK_MS = 30_000;

/** Thư mục tạm trong BACKUP_DIR: tệp đang tạo, tệp tải về máy (xóa ngay sau khi gửi). */
const TEMP_FOLDER = '.tam';

/** Lấy kèm người bấm. */
const WITH_STARTED_BY = { startedBy: { select: { id: true, name: true, email: true } } } as const;
type BackupRunRow = Prisma.BackupRunGetPayload<{ include: typeof WITH_STARTED_BY }>;
type BackupTargetRow = Prisma.BackupTargetGetPayload<object>;

/** Tệp sao lưu tải về máy: đọc dần từ ổ đĩa, xóa sau khi gửi xong. */
export interface BackupDownload {
  fileName: string;
  sizeBytes: number;
  stream: NodeJS.ReadableStream;
}

@Injectable()
export class BackupsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupsService.name);
  /** Đang có lần sao lưu chạy (mỗi lúc một lần). */
  private busy = false;
  /** Bộ hẹn giờ kiểm lịch. */
  private scheduleTimer: NodeJS.Timeout | null = null;

  /**
   * @param prisma       truy cập database
   * @param config       DATABASE_URL, UPLOAD_DIR, BACKUP_DIR
   * @param googleDrive  lưu, xóa tệp trên Google Drive
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly googleDrive: GoogleDriveBackupService,
  ) {}

  /** Bật backend: ghi lỗi các lần còn 'running' từ lần chạy trước, rồi bắt đầu kiểm lịch. */
  async onModuleInit(): Promise<void> {
    await this.prisma.backupRun.updateMany({
      where: { status: 'running' },
      data: { status: 'error', finishedAt: new Date(), error: 'Backend tắt khi đang sao lưu.' },
    });
    this.scheduleTimer = setInterval(() => void this.checkSchedule(), SCHEDULE_CHECK_MS);
  }

  /** Tắt backend: dừng kiểm lịch. */
  onModuleDestroy(): void {
    if (this.scheduleTimer) clearInterval(this.scheduleTimer);
  }

  /* ---------- Đọc ---------- */

  /**
   * Thư mục tuyệt đối của BACKUP_DIR.
   * @returns  đường dẫn
   */
  private get backupRoot(): string {
    return path.resolve(this.config.backupDir);
  }

  /**
   * Thư mục của một nơi lưu trên máy chủ; không cho ra ngoài BACKUP_DIR.
   * @param folder  thư mục con (đã kiểm tra bằng BackupTargetInputSchema)
   * @returns       đường dẫn tuyệt đối
   */
  private serverFolderPath(folder: string): string {
    const resolved = path.resolve(this.backupRoot, folder);
    if (!resolved.startsWith(this.backupRoot + path.sep)) throw new ApiException(422, BACKUP_MESSAGES[422]);
    return resolved;
  }

  /**
   * Các lịch định kì, theo thứ tự thêm.
   * @returns  các lịch (có id)
   */
  private async readSchedules(): Promise<BackupScheduleItem[]> {
    const rows = await this.prisma.backupSchedule.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((row) => ({
      id: row.id,
      enabled: row.enabled,
      frequency: row.frequency as BackupSchedule['frequency'],
      weekday: row.weekday,
      time: row.time,
      targetIds: row.targetIds,
    }));
  }

  /**
   * Đổi dòng nơi lưu sang câu trả (không có refresh token).
   * @param row          dòng nơi lưu
   * @param backupCount  số bản đang có ở đó
   * @returns            theo BackupTargetSchema
   */
  private toTarget(row: BackupTargetRow, backupCount: number): BackupTarget {
    const driveFolderUrl = row.kind === 'googleDrive' && row.googleFolderId ? driveFolderUrlOf(row.googleFolderId) : null;
    const driveFolderId = row.kind === 'googleDrive' ? row.googleFolderId : null;
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      folder: row.folder,
      keepLatest: row.keepLatest,
      googleAccount: row.googleAccount,
      driveFolderId,
      driveFolderUrl,
      backupCount,
    };
  }

  /**
   * Đổi dòng lịch sử sang câu trả.
   * @param row        dòng lần sao lưu kèm người bấm
   * @param checkFile  true thì fileAvailable kiểm thêm tệp còn trên ổ đĩa; false thì chỉ theo database (để kiểm sau, cho các dòng của một trang)
   * @returns          theo BackupRunSchema
   */
  private toRun(row: BackupRunRow, checkFile = true): BackupRun {
    const storedOnServer = row.status === 'ok' && !row.pruned && !!row.storagePath;
    return {
      id: row.id,
      startedAt: toVietnamSeconds(row.startedAt),
      finishedAt: row.finishedAt ? toVietnamSeconds(row.finishedAt) : null,
      trigger: row.trigger,
      startedBy: row.startedBy,
      targetName: row.targetName,
      targetKind: row.targetKind as BackupRun['targetKind'],
      fileName: row.fileName,
      sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
      status: row.status,
      error: row.error,
      fileAvailable: storedOnServer && (!checkFile || existsSync(path.join(this.backupRoot, row.storagePath!))),
      pruned: row.pruned,
    };
  }

  /**
   * Tổng quan trang Sao lưu.
   * @returns  nơi lưu, lịch, lần tới, lần thành công gần nhất, đang chạy không (lịch sử lấy riêng theo trang: findRunsPage)
   */
  async overview(): Promise<BackupsResponse> {
    const [targets, counts, schedules, lastSuccess] = await Promise.all([
      this.prisma.backupTarget.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.backupRun.groupBy({ by: ['targetId'], where: { status: 'ok', pruned: false }, _count: true }),
      this.readSchedules(),
      this.prisma.backupRun.findFirst({ where: { status: 'ok' }, orderBy: { startedAt: 'desc' } }),
    ]);
    const countOf = (targetId: string) => counts.find((count) => count.targetId === targetId)?._count ?? 0;
    return {
      targets: targets.map((target) => this.toTarget(target, countOf(target.id))),
      schedules,
      nextScheduledAt: nextScheduledAtOf(schedules, toVietnamTime(new Date())),
      lastSuccessAt: lastSuccess ? toVietnamSeconds(lastSuccess.startedAt) : null,
      running: this.busy,
      // Bản giả dev-google-drive-connect không cần OAuth client
      googleDriveAvailable: this.googleDrive.available || this.config.usesDemoApi('dev-google-drive-connect'),
    };
  }

  /**
   * Một trang lịch sử: tìm, lọc, sắp xếp trên mọi lần sao lưu (applyListQuery, như bảng tài khoản).
   * Chỉ kiểm tệp trên ổ đĩa cho các dòng của trang trả về.
   * @param listQuery  trang, số dòng, chữ tìm, sắp xếp, lọc (đã kiểm tra)
   * @returns          các dòng của trang, tổng số dòng khớp, trang thật sự, lựa chọn lọc
   */
  async findRunsPage(listQuery: ListQuery): Promise<BackupRunsResponse> {
    const rows = await this.prisma.backupRun.findMany({ include: WITH_STARTED_BY });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const { rows: pageRuns, ...pageMeta } = applyListQuery(
      rows.map((row) => this.toRun(row, false)),
      BACKUP_RUN_LIST_FIELDS,
      listQuery,
      BACKUP_RUN_LIST_DEFAULT_SORTING,
      backupRunExtraSearchText,
    );
    return { ...pageMeta, runs: pageRuns.map((run) => this.toRun(rowById.get(run.id)!)) };
  }

  /* ---------- Nơi lưu, lịch ---------- */

  /**
   * Thêm hoặc sửa một nơi lưu. Nơi lưu Google Drive phải có tài khoản (lần kết nối vừa làm, hoặc tài khoản cũ khi sửa nơi Drive đã kết nối)
   * và thư mục chọn bằng Picker (cổng phải mở được).
   * @param input     thông tin nơi lưu (đã kiểm tra)
   * @param user      người đang lưu (lần kết nối phải của người này)
   * @param targetId  id nơi lưu cần sửa; không có = thêm mới
   * @returns         nơi lưu sau khi lưu
   * @throws          404 không có nơi lưu · 409 trùng thư mục với nơi khác · 422 Drive chưa kết nối, kết nối hết hạn, không mở được thư mục
   */
  async saveTarget(input: BackupTargetInput, user: User, targetId?: string): Promise<BackupTarget> {
    const { driveGrantId, driveFolderId, newDriveFolderName, ...fields } = input;
    const existing = targetId ? await this.prisma.backupTarget.findUnique({ where: { id: targetId } }) : null;
    if (targetId && !existing) throw new ApiException(404, BACKUP_MESSAGES.targetNotFound);

    // Thư mục và tài khoản Google: Drive thì kiểm (chưa dùng lần kết nối), thư mục máy chủ thì bỏ tài khoản
    const placeFields =
      fields.kind === 'googleDrive'
        ? await this.driveFieldsFor({ folderName: fields.folder, driveFolderId: driveFolderId!, newDriveFolderName }, existing, driveGrantId, user)
        : { folder: fields.folder, googleAccount: null, googleRefreshToken: null, googleFolderId: null };

    // Trùng: thư mục máy chủ theo đường dẫn, Drive theo id thư mục
    const duplicate = await this.prisma.backupTarget.findFirst({
      where: {
        kind: fields.kind,
        ...(fields.kind === 'googleDrive' ? { googleFolderId: placeFields.googleFolderId } : { folder: placeFields.folder }),
        NOT: { id: targetId ?? '' },
      },
    });
    if (duplicate) throw new ApiException(409, BACKUP_MESSAGES.duplicateTarget);

    // Lần kết nối dùng một lần: chỉ bỏ khi đã chắc lưu được
    if (fields.kind === 'googleDrive' && driveGrantId) this.googleDrive.takeGrant(driveGrantId, user.id);
    const data = { ...fields, ...placeFields };
    const saved = existing
      ? await this.prisma.backupTarget.update({ where: { id: existing.id }, data })
      : await this.prisma.backupTarget.create({ data: { id: `backup-target-${randomUUID()}`, ...data } });
    const backupCount = await this.prisma.backupRun.count({ where: { targetId: saved.id, status: 'ok', pruned: false } });
    return this.toTarget(saved, backupCount);
  }

  /**
   * Tài khoản Google của nơi lưu Drive: lần kết nối vừa làm, hoặc tài khoản cũ của nơi Drive đang sửa. Không bỏ lần kết nối.
   * @param existing      nơi lưu đang sửa; null = thêm mới
   * @param driveGrantId  lần kết nối vừa làm (nếu có)
   * @param user          người đang lưu
   * @returns             email, refresh token đã mã hóa; isNew = lần kết nối vừa làm
   * @throws              422 kết nối hết hạn · 422 chưa có tài khoản
   */
  private driveAccountFor(existing: BackupTargetRow | null, driveGrantId: string | undefined, user: User): DriveGrant & { isNew: boolean } {
    if (driveGrantId) {
      const grant = this.googleDrive.peekGrant(driveGrantId, user.id);
      if (!grant) throw new ApiException(422, BACKUP_MESSAGES.driveGrantExpired);
      return { ...grant, isNew: true };
    }
    if (existing?.kind === 'googleDrive' && existing.googleAccount) return { ...accountOf(existing), isNew: false };
    throw new ApiException(422, BACKUP_MESSAGES.driveConnectFirst);
  }

  /**
   * Các cột của nơi lưu Drive sắp lưu: tài khoản, id thư mục, tên thư mục.
   * Chỗ lưu là My Drive, hoặc thư mục chọn bằng Picker: mới chọn (hoặc đổi tài khoản) thì hỏi Drive xem cổng mở được không, lấy tên thật;
   * giữ nguyên thì giữ tên cũ. Có tên thư mục mới thì tạo thư mục đó bên trong chỗ lưu rồi lưu vào đó.
   * @param driveFolder    folderName: tên chỗ lưu giao diện gửi · driveFolderId: chỗ lưu · newDriveFolderName: tên thư mục mới (trống = không tạo)
   * @param existing       nơi lưu đang sửa; null = thêm mới
   * @param driveGrantId   lần kết nối vừa làm (nếu có)
   * @param user           người đang lưu
   * @returns              folder, googleAccount, googleRefreshToken, googleFolderId
   * @throws               422 kết nối hết hạn, chưa có tài khoản, không mở được thư mục · 409 Drive không tạo được thư mục mới
   */
  private async driveFieldsFor(
    driveFolder: { folderName: string; driveFolderId: string; newDriveFolderName?: string },
    existing: BackupTargetRow | null,
    driveGrantId: string | undefined,
    user: User,
  ): Promise<Pick<BackupTargetRow, 'folder' | 'googleAccount' | 'googleRefreshToken' | 'googleFolderId'>> {
    const { folderName, driveFolderId, newDriveFolderName } = driveFolder;
    const account = this.driveAccountFor(existing, driveGrantId, user);
    const accountFields = { googleAccount: account.email, googleRefreshToken: account.encryptedRefreshToken };

    // Chỗ lưu: cùng tài khoản, cùng thư mục thì không hỏi Drive; My Drive thì luôn mở được
    let location: { id: string; name: string };
    if (!account.isNew && existing?.googleFolderId === driveFolderId) location = { id: driveFolderId, name: existing.folder };
    else if (driveFolderId === DRIVE_ROOT_FOLDER_ID) location = { id: driveFolderId, name: DRIVE_ROOT_FOLDER_NAME };
    else location = { id: driveFolderId, name: await this.checkedDriveFolderName(account, driveFolderId, folderName) };
    if (!newDriveFolderName) return { folder: location.name, googleFolderId: location.id, ...accountFields };

    /* JUST FOR DEMO: START · tài khoản kết nối bằng bản giả dev-google-drive-connect: không gọi Google, thư mục mới là thư mục giả.
       Bản thật: luôn có refresh token, tạo trên Drive */
    if (!account.encryptedRefreshToken) return { folder: newDriveFolderName, googleFolderId: `demo-${randomUUID()}`, ...accountFields };
    /* JUST FOR DEMO: END */

    // Tạo thư mục mới bên trong chỗ lưu
    const created = await this.googleDrive.createFolder(account, location.id, newDriveFolderName).catch((error: unknown) => {
      throw new ApiException(409, error instanceof Error ? error.message : BACKUP_MESSAGES.driveFolderInvalid);
    });
    return { folder: created.name, googleFolderId: created.id, ...accountFields };
  }

  /**
   * Hỏi Drive xem cổng mở được thư mục Admin vừa chọn không.
   * @param account     tài khoản của nơi lưu
   * @param folderId    id thư mục chọn bằng Picker
   * @param folderName  tên giao diện gửi (chỉ dùng cho tài khoản kết nối bằng bản giả)
   * @returns           tên thư mục trên Drive
   * @throws            422 không mở được thư mục
   */
  private async checkedDriveFolderName(account: DriveGrant, folderId: string, folderName: string): Promise<string> {
    /* JUST FOR DEMO: START · tài khoản kết nối bằng bản giả: không có quyền Google, lấy tên giao diện gửi. Bản thật: luôn có refresh token, hỏi Drive */
    if (!account.encryptedRefreshToken) return folderName || folderId;
    /* JUST FOR DEMO: END */

    const driveName = await this.googleDrive.checkFolder(account, folderId).catch(() => null);
    if (!driveName) throw new ApiException(422, BACKUP_MESSAGES.driveFolderInvalid);
    return driveName;
  }

  /**
   * Tài khoản Drive để mở Picker: lần kết nối vừa làm (không bỏ), hoặc tài khoản của nơi lưu Drive đang sửa.
   * @param accountRef  driveGrantId hoặc targetId (đúng một, đã kiểm bằng schema)
   * @param user        người đang làm (lần kết nối phải của người này)
   * @returns           email và refresh token đã mã hóa
   * @throws            422 kết nối hết hạn · 404 không có nơi lưu · 409 nơi lưu chưa kết nối Drive
   */
  private async driveAccountOf(accountRef: DrivePickerRequest, user: User): Promise<DriveGrant> {
    if (accountRef.driveGrantId) {
      const grant = this.googleDrive.peekGrant(accountRef.driveGrantId, user.id);
      if (!grant) throw new ApiException(422, BACKUP_MESSAGES.driveGrantExpired);
      return grant;
    }
    const target = await this.prisma.backupTarget.findUnique({ where: { id: accountRef.targetId! } });
    if (!target) throw new ApiException(404, BACKUP_MESSAGES.targetNotFound);
    if (target.kind !== 'googleDrive' || !target.googleAccount) throw new ApiException(409, BACKUP_MESSAGES.driveNotConnected);
    return accountOf(target);
  }

  /**
   * Mở Google Picker chọn thư mục Drive cho nơi lưu.
   * @param pickerRequest  tài khoản vừa kết nối (driveGrantId) hoặc nơi lưu Drive đang sửa (targetId)
   * @param user           người đang chọn (lần kết nối phải của người này)
   * @returns              'picker' kèm access token, API key, appId · tài khoản kết nối bằng bản giả: 'demo'
   * @throws               422 kết nối hết hạn · 404 không có nơi lưu · 409 nơi lưu chưa kết nối Drive, Google từ chối cấp token · 503 chưa có API key
   */
  async drivePicker(pickerRequest: DrivePickerRequest, user: User): Promise<DrivePickerResponse> {
    const account = await this.driveAccountOf(pickerRequest, user);

    // Google từ chối cấp token (đã thu hồi quyền…) thì báo câu lỗi
    const session = await this.googleDrive.pickerSession(account).catch((error: unknown) => {
      throw new ApiException(409, error instanceof Error ? error.message : BACKUP_MESSAGES.driveNotConnected);
    });
    if (!session) throw new ApiException(503, BACKUP_MESSAGES.pickerUnavailable);
    return session;
  }

  /**
   * Bỏ một nơi lưu; các lịch không còn lưu vào đó. Bản đã lưu và lịch sử giữ nguyên.
   * @param targetId  id nơi lưu
   * @throws          404 không có nơi lưu
   */
  async removeTarget(targetId: string): Promise<void> {
    const existing = await this.prisma.backupTarget.findUnique({ where: { id: targetId } });
    if (!existing) throw new ApiException(404, BACKUP_MESSAGES.targetNotFound);
    const schedules = await this.readSchedules();
    await this.prisma.$transaction([
      this.prisma.backupTarget.delete({ where: { id: targetId } }),
      ...schedules
        .filter((schedule) => schedule.targetIds.includes(targetId))
        .map((schedule) =>
          this.prisma.backupSchedule.update({ where: { id: schedule.id }, data: { targetIds: schedule.targetIds.filter((id) => id !== targetId) } }),
        ),
    ]);
  }

  /**
   * Thêm hoặc sửa một lịch định kì.
   * @param schedule    lịch (đã kiểm tra)
   * @param scheduleId  id lịch cần sửa; không có = thêm mới
   * @returns           tổng quan sau khi lưu
   * @throws            404 không có lịch · 422 lịch chọn nơi lưu không có
   */
  async saveSchedule(schedule: BackupSchedule, scheduleId?: string): Promise<BackupsResponse> {
    if (scheduleId && !(await this.prisma.backupSchedule.findUnique({ where: { id: scheduleId } }))) throw new ApiException(404, BACKUP_MESSAGES.scheduleNotFound);
    const known = await this.prisma.backupTarget.count({ where: { id: { in: schedule.targetIds } } });
    if (known !== new Set(schedule.targetIds).size) throw new ApiException(422, BACKUP_MESSAGES.unknownScheduleTarget);
    if (scheduleId) await this.prisma.backupSchedule.update({ where: { id: scheduleId }, data: schedule });
    else await this.prisma.backupSchedule.create({ data: { id: `backup-schedule-${randomUUID()}`, ...schedule } });
    return this.overview();
  }

  /**
   * Bỏ một lịch định kì (lịch sử giữ nguyên).
   * @param scheduleId  id lịch
   * @returns           tổng quan sau khi bỏ
   * @throws            404 không có lịch
   */
  async removeSchedule(scheduleId: string): Promise<BackupsResponse> {
    const removed = await this.prisma.backupSchedule.deleteMany({ where: { id: scheduleId } });
    if (!removed.count) throw new ApiException(404, BACKUP_MESSAGES.scheduleNotFound);
    return this.overview();
  }

  /* ---------- Chạy sao lưu ---------- */

  /**
   * Giữ chỗ chạy (mỗi lúc một lần).
   * @throws  409 đang có lần khác chạy
   */
  private claim(): void {
    if (this.busy) throw new ApiException(409, BACKUP_MESSAGES.busy);
    this.busy = true;
  }

  /**
   * Sao lưu ngay: tạo một bản rồi lưu vào các nơi đã chọn, chạy nền.
   * @param targetIds  id các nơi lưu (đã kiểm tra: ít nhất một, không trùng)
   * @param starter    người bấm
   * @returns          các lần sao lưu vừa bắt đầu (status 'running'), mỗi nơi một dòng
   * @throws           404 có nơi lưu không còn · 409 đang có lần khác chạy, có nơi lưu Drive chưa kết nối
   */
  async runNow(targetIds: readonly string[], starter: User): Promise<BackupRun[]> {
    const targets = await this.prisma.backupTarget.findMany({ where: { id: { in: [...targetIds] } }, orderBy: { createdAt: 'asc' } });
    if (targets.length !== targetIds.length) throw new ApiException(404, BACKUP_MESSAGES.targetNotFound);
    if (targets.some((target) => target.kind === 'googleDrive' && !target.googleAccount)) throw new ApiException(409, BACKUP_MESSAGES.driveNotConnected);
    this.claim();
    try {
      const startedAt = new Date();
      const runs = await this.startRuns(targets, { startedAt, trigger: 'manual', startedById: starter.id });
      void this.finishRuns(targets, runs, startedAt).finally(() => (this.busy = false));
      return runs.map((run) => this.toRun(run));
    } catch (error) {
      this.busy = false;
      throw error;
    }
  }

  /**
   * Ghi các dòng 'running', mỗi nơi lưu một dòng.
   * @param targets  các nơi lưu
   * @param fields   lúc bắt đầu, chạy tay hay theo lịch, người bấm, phút theo lịch
   * @returns        các dòng vừa ghi, cùng thứ tự với targets
   */
  private startRuns(
    targets: readonly BackupTargetRow[],
    fields: { startedAt: Date; trigger: 'manual' | 'scheduled'; startedById?: string; scheduledAt?: Date },
  ): Promise<BackupRunRow[]> {
    const fileName = backupFileName(toVietnamSeconds(fields.startedAt));
    return this.prisma.$transaction(
      targets.map((target) =>
        this.prisma.backupRun.create({
          data: { id: `backup-run-${randomUUID()}`, ...fields, targetId: target.id, targetName: target.name, targetKind: target.kind, fileName, status: 'running' },
          include: WITH_STARTED_BY,
        }),
      ),
    );
  }

  /**
   * Tạo một tệp sao lưu rồi lưu vào từng nơi; nơi nào lỗi thì dòng đó ghi lỗi, các nơi khác vẫn lưu. Xong thì xóa bớt bản cũ.
   * @param targets    các nơi lưu
   * @param runs       các dòng 'running' tương ứng
   * @param startedAt  lúc bắt đầu
   */
  private async finishRuns(targets: readonly BackupTargetRow[], runs: readonly BackupRunRow[], startedAt: Date): Promise<void> {
    const fileName = runs[0]!.fileName;
    const tempPath = path.join(this.backupRoot, TEMP_FOLDER, `${randomUUID()}-${fileName}`);
    try {
      // Một tệp cho mọi nơi lưu
      let sizeBytes: number;
      try {
        sizeBytes = await this.createArchive(tempPath, startedAt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.backupRun.updateMany({ where: { id: { in: runs.map((run) => run.id) } }, data: { status: 'error', finishedAt: new Date(), error: message } });
        this.logger.error(`Sao lưu lỗi: ${message}`);
        return;
      }

      // Lưu vào từng nơi
      for (const [index, target] of targets.entries()) {
        const runId = runs[index]!.id;
        try {
          const stored = await this.storeArchive(target, tempPath, fileName);
          await this.prisma.backupRun.update({ where: { id: runId }, data: { status: 'ok', finishedAt: new Date(), sizeBytes, ...stored } });
          await this.prune(target);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.prisma.backupRun.update({ where: { id: runId }, data: { status: 'error', finishedAt: new Date(), error: message } });
          this.logger.error(`Sao lưu vào "${target.name}" lỗi: ${message}`);
        }
      }
    } finally {
      await rm(tempPath, { force: true });
    }
  }

  /**
   * Tạo tệp sao lưu.
   * @param outputPath  tệp cần tạo
   * @param startedAt   lúc bắt đầu
   * @returns           dung lượng, byte
   */
  private createArchive(outputPath: string, startedAt: Date): Promise<number> {
    return createBackupArchive({ databaseUrl: this.config.databaseUrl, uploadDir: this.config.uploadDir, outputPath, startedAt: toVietnamSeconds(startedAt) });
  }

  /**
   * Lưu tệp đã tạo vào một nơi lưu.
   * @param target    nơi lưu
   * @param tempPath  tệp đã tạo
   * @param fileName  tên tệp
   * @returns         chỗ đã lưu: storagePath (trong BACKUP_DIR) hoặc driveFileId
   */
  private async storeArchive(target: BackupTargetRow, tempPath: string, fileName: string): Promise<{ storagePath?: string; driveFileId?: string }> {
    if (target.kind === 'googleDrive') return { driveFileId: await this.googleDrive.upload(target, tempPath, fileName) };
    const folder = this.serverFolderPath(target.folder);
    await mkdir(folder, { recursive: true });
    await copyFile(tempPath, path.join(folder, fileName));
    return { storagePath: path.relative(this.backupRoot, path.join(folder, fileName)) };
  }

  /**
   * Xóa các bản quá số bản giữ lại ở một nơi lưu (giữ keepLatest bản mới nhất), ghi pruned.
   * @param target  nơi lưu
   */
  private async prune(target: BackupTargetRow): Promise<void> {
    const extra = await this.prisma.backupRun.findMany({
      where: { targetId: target.id, status: 'ok', pruned: false },
      orderBy: { startedAt: 'desc' },
      skip: target.keepLatest,
    });
    for (const run of extra) {
      try {
        if (run.storagePath) await rm(path.join(this.backupRoot, run.storagePath), { force: true });
        if (run.driveFileId) await this.googleDrive.remove(target, run.driveFileId);
        await this.prisma.backupRun.update({ where: { id: run.id }, data: { pruned: true } });
      } catch (error) {
        this.logger.warn(`Không xóa được bản cũ ${run.fileName} ở "${target.name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Sao lưu rồi trả tệp để tải về máy (không giữ trên máy chủ), ghi vào lịch sử.
   * @param starter  người bấm
   * @returns        tệp: đọc dần, xóa khỏi ổ đĩa sau khi gửi xong
   * @throws         409 đang có lần khác chạy · 500 kèm câu lỗi khi không tạo được
   */
  async download(starter: User): Promise<BackupDownload> {
    this.claim();
    const startedAt = new Date();
    const fileName = backupFileName(toVietnamSeconds(startedAt));
    const tempPath = path.join(this.backupRoot, TEMP_FOLDER, `${randomUUID()}-${fileName}`);
    const runId = `backup-run-${randomUUID()}`;
    await this.prisma.backupRun.create({
      data: { id: runId, startedAt, trigger: 'manual', startedById: starter.id, targetName: 'Tải về máy', targetKind: 'download', fileName, status: 'running' },
    });
    try {
      const sizeBytes = await this.createArchive(tempPath, startedAt);
      await this.prisma.backupRun.update({ where: { id: runId }, data: { status: 'ok', finishedAt: new Date(), sizeBytes } });
      const stream = createReadStream(tempPath);
      stream.on('close', () => void rm(tempPath, { force: true }));
      return { fileName, sizeBytes, stream };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.backupRun.update({ where: { id: runId }, data: { status: 'error', finishedAt: new Date(), error: message } });
      throw new ApiException(500, message);
    } finally {
      this.busy = false;
    }
  }

  /**
   * Tải về một bản đã lưu ở thư mục trên máy chủ.
   * @param runId  id lần sao lưu
   * @returns      tệp
   * @throws       404 không có lần sao lưu, hoặc tệp không còn
   */
  async runFile(runId: string): Promise<BackupDownload> {
    const row = await this.prisma.backupRun.findUnique({ where: { id: runId }, include: WITH_STARTED_BY });
    if (!row) throw new ApiException(404, BACKUP_MESSAGES.runNotFound);
    if (!this.toRun(row).fileAvailable) throw new ApiException(404, BACKUP_MESSAGES.fileGone);
    const filePath = path.join(this.backupRoot, row.storagePath!);
    return { fileName: row.fileName, sizeBytes: Number(row.sizeBytes ?? 0), stream: createReadStream(filePath) };
  }

  /* ---------- Lịch ---------- */

  /**
   * Kiểm lịch: các lịch tới phút chạy mà chưa chạy phút đó (kể cả trước khi backend khởi động lại) thì sao lưu một lần
   * vào mọi nơi của các lịch đó. Đang có lần khác chạy thì bỏ qua lần này. Nơi lưu Drive chưa kết nối ghi lỗi trong lịch sử.
   * @param now  lúc kiểm (để test)
   */
  async checkSchedule(now = new Date()): Promise<void> {
    const minute = toVietnamTime(now);
    const dueSchedules = (await this.readSchedules()).filter((schedule) => isScheduledMinute(schedule, minute));
    if (!dueSchedules.length || this.busy) return;
    const scheduledAt = fromVietnamTime(minute);
    if (await this.prisma.backupRun.findFirst({ where: { trigger: 'scheduled', scheduledAt } })) return;

    const targetIds = [...new Set(dueSchedules.flatMap((schedule) => schedule.targetIds))];
    const targets = await this.prisma.backupTarget.findMany({ where: { id: { in: targetIds } }, orderBy: { createdAt: 'asc' } });
    if (!targets.length) return;
    this.busy = true;
    try {
      const runs = await this.startRuns(targets, { startedAt: now, trigger: 'scheduled', scheduledAt });

      // Drive chưa kết nối: ghi lỗi ngay, các nơi khác vẫn chạy
      const notConnected = targets.filter((target) => target.kind === 'googleDrive' && !target.googleAccount);
      if (notConnected.length) {
        await this.prisma.backupRun.updateMany({
          where: { id: { in: runs.filter((_, index) => notConnected.includes(targets[index]!)).map((run) => run.id) } },
          data: { status: 'error', finishedAt: new Date(), error: BACKUP_MESSAGES.driveNotConnected },
        });
      }
      const ready = targets.map((target, index) => ({ target, run: runs[index]! })).filter(({ target }) => !notConnected.includes(target));
      if (ready.length) await this.finishRuns(ready.map(({ target }) => target), ready.map(({ run }) => run), now);
    } catch (error) {
      this.logger.error(`Sao lưu định kì lỗi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.busy = false;
    }
  }

  /**
   * Chờ lần sao lưu đang chạy nền xong (để test).
   * @param timeoutMs  chờ tối đa
   */
  async waitIdle(timeoutMs = 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.busy && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
