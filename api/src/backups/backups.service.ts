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
  BACKUP_RUNS_LIMIT,
  backupFileName,
  isScheduledMinute,
  nextScheduledAt,
  type BackupRun,
  type BackupSchedule,
  type BackupTarget,
  type BackupTargetInput,
  type BackupsResponse,
} from '@ulaw/shared';
import { ApiException } from '../common/api-exception';
import { PrismaService } from '../common/prisma.service';
import { fromVietnamTime, toVietnamSeconds, toVietnamTime } from '../common/vietnam-time';
import { AppConfig } from '../config/app-config';
import type { Prisma, User } from '../generated/prisma/client';
import { createBackupArchive } from './backup-archive';
import { GoogleDriveBackupService } from './google-drive-backup.service';

/** Id dòng lịch duy nhất. */
const SCHEDULE_ROW_ID = 1;

/** Lịch khi chưa có dòng nào (database chưa seed): tắt. */
const EMPTY_SCHEDULE: BackupSchedule = { enabled: false, frequency: 'daily', weekday: 1, time: '02:00', targetIds: [] };

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
   * Lịch đang dùng.
   * @returns  lịch; chưa có dòng nào thì lịch tắt
   */
  private async readSchedule(): Promise<BackupSchedule> {
    const row = await this.prisma.backupSchedule.findUnique({ where: { id: SCHEDULE_ROW_ID } });
    if (!row) return EMPTY_SCHEDULE;
    return { enabled: row.enabled, frequency: row.frequency as BackupSchedule['frequency'], weekday: row.weekday, time: row.time, targetIds: row.targetIds };
  }

  /**
   * Đổi dòng nơi lưu sang câu trả (không có refresh token).
   * @param row          dòng nơi lưu
   * @param backupCount  số bản đang có ở đó
   * @returns            theo BackupTargetSchema
   */
  private toTarget(row: BackupTargetRow, backupCount: number): BackupTarget {
    return { id: row.id, name: row.name, kind: row.kind, folder: row.folder, keepLatest: row.keepLatest, googleAccount: row.googleAccount, backupCount };
  }

  /**
   * Đổi dòng lịch sử sang câu trả.
   * @param row  dòng lần sao lưu kèm người bấm
   * @returns    theo BackupRunSchema; fileAvailable = tệp còn trên ổ đĩa máy chủ
   */
  private toRun(row: BackupRunRow): BackupRun {
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
      fileAvailable: row.status === 'ok' && !row.pruned && !!row.storagePath && existsSync(path.join(this.backupRoot, row.storagePath)),
      pruned: row.pruned,
    };
  }

  /**
   * Tổng quan trang Sao lưu.
   * @returns  nơi lưu, lịch, lần tới, lần thành công gần nhất, đang chạy không, lịch sử gần nhất
   */
  async overview(): Promise<BackupsResponse> {
    const [targets, counts, schedule, runs, lastSuccess] = await Promise.all([
      this.prisma.backupTarget.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.backupRun.groupBy({ by: ['targetId'], where: { status: 'ok', pruned: false }, _count: true }),
      this.readSchedule(),
      this.prisma.backupRun.findMany({ orderBy: { startedAt: 'desc' }, take: BACKUP_RUNS_LIMIT, include: WITH_STARTED_BY }),
      this.prisma.backupRun.findFirst({ where: { status: 'ok' }, orderBy: { startedAt: 'desc' } }),
    ]);
    const countOf = (targetId: string) => counts.find((count) => count.targetId === targetId)?._count ?? 0;
    return {
      targets: targets.map((target) => this.toTarget(target, countOf(target.id))),
      schedule,
      nextScheduledAt: nextScheduledAt(schedule, toVietnamTime(new Date())),
      lastSuccessAt: lastSuccess ? toVietnamSeconds(lastSuccess.startedAt) : null,
      running: this.busy,
      googleDriveAvailable: this.googleDrive.available,
      runs: runs.map((run) => this.toRun(run)),
    };
  }

  /* ---------- Nơi lưu, lịch ---------- */

  /**
   * Thêm hoặc sửa một nơi lưu. Đổi kiểu hoặc thư mục Drive thì phải kết nối lại tài khoản Google.
   * @param input     thông tin nơi lưu (đã kiểm tra)
   * @param targetId  id nơi lưu cần sửa; không có = thêm mới
   * @returns         nơi lưu sau khi lưu
   * @throws          404 không có nơi lưu · 409 trùng kiểu và thư mục với nơi khác
   */
  async saveTarget(input: BackupTargetInput, targetId?: string): Promise<BackupTarget> {
    const existing = targetId ? await this.prisma.backupTarget.findUnique({ where: { id: targetId } }) : null;
    if (targetId && !existing) throw new ApiException(404, BACKUP_MESSAGES.targetNotFound);
    const duplicate = await this.prisma.backupTarget.findFirst({ where: { kind: input.kind, folder: input.folder, NOT: { id: targetId ?? '' } } });
    if (duplicate) throw new ApiException(409, BACKUP_MESSAGES.duplicateTarget);

    // Drive: đổi kiểu thì bỏ tài khoản đã kết nối; đổi tên thư mục thì tạo thư mục mới ở lần lưu tới
    const keepsGoogle = existing?.kind === input.kind;
    const googleFields = keepsGoogle
      ? { googleFolderId: existing!.folder === input.folder ? existing!.googleFolderId : null }
      : { googleAccount: null, googleRefreshToken: null, googleFolderId: null };
    const saved = existing
      ? await this.prisma.backupTarget.update({ where: { id: existing.id }, data: { ...input, ...googleFields } })
      : await this.prisma.backupTarget.create({ data: { id: `backup-target-${randomUUID()}`, ...input } });
    const backupCount = await this.prisma.backupRun.count({ where: { targetId: saved.id, status: 'ok', pruned: false } });
    return this.toTarget(saved, backupCount);
  }

  /**
   * Bỏ một nơi lưu; lịch không còn lưu vào đó. Bản đã lưu và lịch sử giữ nguyên.
   * @param targetId  id nơi lưu
   * @throws          404 không có nơi lưu
   */
  async removeTarget(targetId: string): Promise<void> {
    const existing = await this.prisma.backupTarget.findUnique({ where: { id: targetId } });
    if (!existing) throw new ApiException(404, BACKUP_MESSAGES.targetNotFound);
    const schedule = await this.readSchedule();
    await this.prisma.$transaction([
      this.prisma.backupTarget.delete({ where: { id: targetId } }),
      this.prisma.backupSchedule.updateMany({ where: { id: SCHEDULE_ROW_ID }, data: { targetIds: schedule.targetIds.filter((id) => id !== targetId) } }),
    ]);
  }

  /**
   * Lưu lịch định kì.
   * @param schedule  lịch (đã kiểm tra)
   * @returns         tổng quan sau khi lưu
   * @throws          422 lịch chọn nơi lưu không có
   */
  async saveSchedule(schedule: BackupSchedule): Promise<BackupsResponse> {
    const known = await this.prisma.backupTarget.count({ where: { id: { in: schedule.targetIds } } });
    if (known !== new Set(schedule.targetIds).size) throw new ApiException(422, BACKUP_MESSAGES.unknownScheduleTarget);
    await this.prisma.backupSchedule.upsert({ where: { id: SCHEDULE_ROW_ID }, create: { id: SCHEDULE_ROW_ID, ...schedule }, update: schedule });
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
   * Sao lưu ngay vào một nơi lưu, chạy nền.
   * @param targetId  id nơi lưu
   * @param starter   người bấm
   * @returns         lần sao lưu vừa bắt đầu (status 'running')
   * @throws          404 không có nơi lưu · 409 đang có lần khác chạy, nơi lưu Drive chưa kết nối
   */
  async runNow(targetId: string, starter: User): Promise<BackupRun> {
    const target = await this.prisma.backupTarget.findUnique({ where: { id: targetId } });
    if (!target) throw new ApiException(404, BACKUP_MESSAGES.targetNotFound);
    if (target.kind === 'googleDrive' && !target.googleRefreshToken) throw new ApiException(409, BACKUP_MESSAGES.driveNotConnected);
    this.claim();
    try {
      const startedAt = new Date();
      const [run] = await this.startRuns([target], { startedAt, trigger: 'manual', startedById: starter.id });
      void this.finishRuns([target], [run!], startedAt).finally(() => (this.busy = false));
      return this.toRun(run!);
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
   * Kiểm lịch: tới phút chạy mà chưa chạy phút đó (kể cả trước khi backend khởi động lại) thì sao lưu vào các nơi trong lịch.
   * Đang có lần khác chạy thì bỏ qua lần này. Nơi lưu Drive chưa kết nối ghi lỗi trong lịch sử.
   * @param now  lúc kiểm (để test)
   */
  async checkSchedule(now = new Date()): Promise<void> {
    const minute = toVietnamTime(now);
    const schedule = await this.readSchedule();
    if (!isScheduledMinute(schedule, minute) || this.busy) return;
    const scheduledAt = fromVietnamTime(minute);
    if (await this.prisma.backupRun.findFirst({ where: { trigger: 'scheduled', scheduledAt } })) return;

    const targets = await this.prisma.backupTarget.findMany({ where: { id: { in: schedule.targetIds } }, orderBy: { createdAt: 'asc' } });
    if (!targets.length) return;
    this.busy = true;
    try {
      const runs = await this.startRuns(targets, { startedAt: now, trigger: 'scheduled', scheduledAt });

      // Drive chưa kết nối: ghi lỗi ngay, các nơi khác vẫn chạy
      const notConnected = targets.filter((target) => target.kind === 'googleDrive' && !target.googleRefreshToken);
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
