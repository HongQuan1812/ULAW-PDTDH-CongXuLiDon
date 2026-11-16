/* Test nhóm API Sao lưu: quyền, nơi lưu, lịch, sao lưu ngay, giữ N bản, tải về, chạy theo lịch.
   Cần database đã migrate và seed. Thư mục sao lưu là một thư mục tạm (BACKUP_DIR đặt trước khi dựng app), xóa khi xong.
   Phần tạo tệp thật cần pg_dump (có trong image api); máy không có pg_dump thì bỏ qua các test đó.
   Xong thì trả nơi lưu, lịch về như seed và xóa lịch sử do test tạo. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import {
  ApiErrorBodySchema,
  BACKUP_ENDPOINTS,
  BACKUP_MESSAGES,
  BACKUP_SCHEDULE_SEED,
  BACKUP_TARGETS_SEED,
  BackupRunSchema,
  BackupTargetSchema,
  BackupsResponseSchema,
  backupRunFilePath,
  backupTargetPath,
  connectGoogleDrivePath,
  type BackupTargetInput,
  type RoleId,
} from '@ulaw/shared';
import { BackupsService } from '../src/backups/backups.service';
import { PrismaService } from '../src/common/prisma.service';
import { fromVietnamTime } from '../src/common/vietnam-time';
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

  /** Đưa nơi lưu, lịch về như seed; xóa lịch sử. */
  async function resetBackups(): Promise<void> {
    await prisma.backupRun.deleteMany();
    await prisma.backupTarget.deleteMany();
    await prisma.backupTarget.createMany({ data: [...BACKUP_TARGETS_SEED] });
    await prisma.backupSchedule.upsert({ where: { id: 1 }, create: { id: 1, ...BACKUP_SCHEDULE_SEED }, update: BACKUP_SCHEDULE_SEED });
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
    expect(overview.schedule).toEqual(BACKUP_SCHEDULE_SEED);
    expect(overview.nextScheduledAt).toMatch(/T02:00$/);
    expect(overview).toMatchObject({ lastSuccessAt: null, running: false, runs: [] });
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
    await request(server()).put(api(BACKUP_ENDPOINTS.schedule)).set('Cookie', adminCookie).send({ ...BACKUP_SCHEDULE_SEED, targetIds: ['backup-target-server', added.id] }).expect(200);
    await request(server()).delete(api(backupTargetPath(added.id))).set('Cookie', adminCookie).expect(204);
    const overview = BackupsResponseSchema.parse((await request(server()).get(api(BACKUP_ENDPOINTS.overview)).set('Cookie', adminCookie)).body);
    expect(overview.schedule.targetIds).toEqual(['backup-target-server']);
    await request(server()).delete(api(backupTargetPath(added.id))).set('Cookie', adminCookie).expect(404);
  });

  it('lịch: chọn nơi lưu không có thì 422; bật mà không chọn nơi nào thì 422; tắt thì không có lần tới', async () => {
    const unknown = await request(server()).put(api(BACKUP_ENDPOINTS.schedule)).set('Cookie', adminCookie).send({ ...BACKUP_SCHEDULE_SEED, targetIds: ['khong-co'] }).expect(422);
    expect(messageOf(unknown)).toBe(BACKUP_MESSAGES.unknownScheduleTarget);
    await request(server()).put(api(BACKUP_ENDPOINTS.schedule)).set('Cookie', adminCookie).send({ ...BACKUP_SCHEDULE_SEED, targetIds: [] }).expect(422);
    const off = await request(server()).put(api(BACKUP_ENDPOINTS.schedule)).set('Cookie', adminCookie).send({ ...BACKUP_SCHEDULE_SEED, enabled: false }).expect(200);
    expect(off.body.nextScheduledAt).toBeNull();
    await request(server()).put(api(BACKUP_ENDPOINTS.schedule)).set('Cookie', adminCookie).send(BACKUP_SCHEDULE_SEED).expect(200);
  });

  it('nơi lưu Google Drive chưa kết nối: sao lưu vào đó 409; không có nơi lưu 404', async () => {
    const drive = (await request(server()).post(api(BACKUP_ENDPOINTS.targets)).set('Cookie', adminCookie).send({ name: 'Drive', kind: 'googleDrive', folder: 'Sao lưu', keepLatest: 3 }).expect(201)).body;
    const notConnected = await request(server()).post(api(BACKUP_ENDPOINTS.run)).set('Cookie', adminCookie).send({ targetId: drive.id }).expect(409);
    expect(messageOf(notConnected)).toBe(BACKUP_MESSAGES.driveNotConnected);
    await request(server()).post(api(BACKUP_ENDPOINTS.run)).set('Cookie', adminCookie).send({ targetId: 'khong-co' }).expect(404);

    // Kết nối: có OAuth client thì trả đường dẫn sang Google xin quyền drive.file; nơi lưu không phải Drive thì 404
    const connect = await request(server()).post(api(connectGoogleDrivePath(drive.id))).set('Cookie', adminCookie);
    if (connect.status === 200) expect(connect.body.url).toContain('drive.file');
    else expect(connect.status).toBe(503);
    await request(server()).post(api(connectGoogleDrivePath('backup-target-server'))).set('Cookie', adminCookie).expect(404);
    await request(server()).delete(api(backupTargetPath(drive.id))).set('Cookie', adminCookie).expect(204);
  });

  it.skipIf(!HAS_PG_DUMP)('sao lưu ngay vào thư mục trên máy chủ: chạy nền, xong thì có tệp, tải về được; quá số bản giữ lại thì bản cũ bị xóa', async () => {
    await prisma.backupTarget.update({ where: { id: 'backup-target-server' }, data: { keepLatest: 1 } });
    const runIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const started = BackupRunSchema.parse((await request(server()).post(api(BACKUP_ENDPOINTS.run)).set('Cookie', adminCookie).send({ targetId: 'backup-target-server' }).expect(202)).body);
      expect(started.status).toBe('running');
      runIds.push(started.id);
      // Đang chạy thì bản khác 409
      if (i === 0) await request(server()).post(api(BACKUP_ENDPOINTS.download)).set('Cookie', adminCookie).expect(409);
      await backupsService.waitIdle();
      // Hai lần trong cùng một giây thì trùng tên tệp: chờ sang giây sau
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    const overview = BackupsResponseSchema.parse((await request(server()).get(api(BACKUP_ENDPOINTS.overview)).set('Cookie', adminCookie)).body);
    const [newer, older] = runIds.reverse().map((id) => overview.runs.find((run) => run.id === id)!);
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

  it.skipIf(!HAS_PG_DUMP)('sao lưu rồi tải về máy: trả tệp .tar.gz, ghi vào lịch sử, không giữ lại trên máy chủ', async () => {
    const response = await request(server()).post(api(BACKUP_ENDPOINTS.download)).set('Cookie', adminCookie).buffer(true).expect(200);
    expect(response.headers['content-disposition']).toMatch(/sao-luu-\d{8}-\d{6}\.tar\.gz/);
    expect(Number(response.headers['content-length'])).toBeGreaterThan(0);
    const run = await prisma.backupRun.findFirstOrThrow({ where: { targetKind: 'download' }, orderBy: { startedAt: 'desc' } });
    expect(run).toMatchObject({ status: 'ok', storagePath: null });
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
