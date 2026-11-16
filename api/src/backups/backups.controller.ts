/* Nhóm API Sao lưu: tổng quan, nơi lưu, kết nối Google Drive, lịch định kì, sao lưu ngay, tải về. Mọi lệnh cần quyền manageBackups.
   Các lệnh trả tệp gửi .tar.gz, tên tệp trong Content-Disposition. */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  BACKUP_ENDPOINTS,
  BACKUP_MESSAGES,
  BACKUP_RUN_LIST_FIELDS,
  BackupRunSchema,
  BackupRunsResponseSchema,
  COMMON_MESSAGES,
  BackupScheduleSchema,
  BackupTargetInputSchema,
  BackupTargetSchema,
  BackupsResponseSchema,
  ConnectGoogleDriveRequestSchema,
  ConnectGoogleDriveResponseSchema,
  DRIVE_ERROR_PARAM,
  RunBackupRequestSchema,
  parseListQuery,
  type BackupRun,
  type BackupRunsResponse,
  type BackupTarget,
  type BackupsResponse,
  type ConnectGoogleDriveResponse,
  type DriveError,
} from '@ulaw/shared';
import type { ZodType } from 'zod';
import { CurrentUser, RequirePermission } from '../auth/require-permission.decorator';
import { readCookie } from '../auth/session-cookie';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import { realApiNotBuilt } from '../config/demo-apis';
import { AppConfig } from '../config/app-config';
import type { User } from '../generated/prisma/client';
import { BackupsService, type BackupDownload } from './backups.service';
import { DRIVE_STATE_COOKIE_NAME, GoogleDriveBackupService, decodeDriveState, driveStateCookieOptions } from './google-drive-backup.service';

/** Trang Sao lưu của giao diện (hash router: #/sao-luu), nơi Google Drive chuyển về. */
const WEB_BACKUPS_HASH_PATH = '/sao-luu';

/**
 * Kiểm tra body theo schema, giống API giả.
 * @param requestBody  body chưa kiểm tra
 * @param schema       schema cần khớp
 * @returns            body đã kiểm tra
 * @throws             422 kèm câu báo của ô đầu tiên bị sai
 */
function parseOrReject<Output>(requestBody: unknown, schema: ZodType<Output>): Output {
  const parsed = schema.safeParse(requestBody);
  if (parsed.success) return parsed.data;
  throw new ApiException(422, parsed.error.issues[0]?.message ?? BACKUP_MESSAGES[422]);
}

/**
 * Gửi tệp sao lưu về trình duyệt.
 * @param backupFile  tệp
 * @param response    để đặt Content-Type, Content-Length, Content-Disposition
 * @returns           nội dung đọc dần
 */
function sendBackupFile(backupFile: BackupDownload, response: Response): StreamableFile {
  response.setHeader('Content-Type', 'application/gzip');
  response.setHeader('Content-Length', String(backupFile.sizeBytes));
  response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(backupFile.fileName)}`);
  return new StreamableFile(backupFile.stream as never);
}

@ApiTags('backups')
@Controller()
@RequirePermission('manageBackups', BACKUP_MESSAGES[403])
export class BackupsController {
  /**
   * @param backupsService  nơi lưu, lịch, chạy sao lưu
   * @param googleDrive     kết nối Google Drive
   * @param appConfig       địa chỉ gốc của cổng (chuyển về trang Sao lưu), APP_ENV (cookie)
   */
  constructor(
    private readonly backupsService: BackupsService,
    private readonly googleDrive: GoogleDriveBackupService,
    private readonly appConfig: AppConfig,
  ) {}

  /** Tổng quan trang Sao lưu. */
  @Get(BACKUP_ENDPOINTS.overview)
  @ApiOkResponse({ schema: openApiSchemaOf(BackupsResponseSchema) })
  overview(): Promise<BackupsResponse> {
    return this.backupsService.overview();
  }

  /**
   * Một trang lịch sử sao lưu.
   * @param queryParams  page, pageSize, search, sort, filters (xem listQueryParams)
   * @throws             422 điều kiện tìm, lọc, sắp xếp sai
   */
  @Get(BACKUP_ENDPOINTS.runs)
  @ApiOkResponse({ schema: openApiSchemaOf(BackupRunsResponseSchema) })
  runs(@Query() queryParams: Record<string, string | undefined>): Promise<BackupRunsResponse> {
    const listQuery = parseListQuery(queryParams, BACKUP_RUN_LIST_FIELDS);
    if (!listQuery) throw new ApiException(422, COMMON_MESSAGES.listQuery);
    return this.backupsService.findRunsPage(listQuery);
  }

  /**
   * Thêm nơi lưu.
   * @throws  422 sai dạng, Drive chưa kết nối / kết nối hết hạn · 409 trùng thư mục
   */
  @Post(BACKUP_ENDPOINTS.targets)
  @ApiOkResponse({ schema: openApiSchemaOf(BackupTargetSchema) })
  addTarget(@CurrentUser() user: User, @Body() requestBody: unknown): Promise<BackupTarget> {
    return this.backupsService.saveTarget(parseOrReject(requestBody, BackupTargetInputSchema), user);
  }

  /**
   * Sửa nơi lưu.
   * @throws  422 sai dạng · 404 không có · 409 trùng thư mục
   */
  @Put(BACKUP_ENDPOINTS.target)
  @ApiOkResponse({ schema: openApiSchemaOf(BackupTargetSchema) })
  saveTarget(@CurrentUser() user: User, @Param('targetId') targetId: string, @Body() requestBody: unknown): Promise<BackupTarget> {
    return this.backupsService.saveTarget(parseOrReject(requestBody, BackupTargetInputSchema), user, targetId);
  }

  /**
   * Bỏ nơi lưu.
   * @throws  404 không có
   */
  @Delete(BACKUP_ENDPOINTS.target)
  @HttpCode(204)
  removeTarget(@Param('targetId') targetId: string): Promise<void> {
    return this.backupsService.removeTarget(targetId);
  }

  /**
   * Kết nối một tài khoản Google Drive (từ hộp thêm / sửa nơi lưu, trước khi Lưu).
   * @param user         người đang đăng nhập (chỉ người này dùng được driveGrantId trả về)
   * @param requestBody  ConnectGoogleDriveRequest
   * @returns            bản giả: 'connected' kèm driveGrantId, email
   * @throws             422 email sai dạng · 501 bản thật chưa phát triển
   */
  @Post(BACKUP_ENDPOINTS.driveConnect)
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchemaOf(ConnectGoogleDriveResponseSchema) })
  connectGoogleDrive(@CurrentUser() user: User, @Body() requestBody: unknown): ConnectGoogleDriveResponse {
    const connectRequest = parseOrReject(requestBody ?? {}, ConnectGoogleDriveRequestSchema);

    /* JUST FOR DEMO: START · bản giả dev-backup-drive: không qua Google, tài khoản là email gửi kèm (mặc định email người đang đăng nhập),
       không có refresh token nên sao lưu vào đó báo lỗi trong lịch sử. Bản thật: trả 'redirect' sang Google (popup), callback báo driveGrantId */
    if (this.appConfig.usesDemoApi('dev-backup-drive')) {
      const email = connectRequest.email ?? user.email;
      return { kind: 'connected', driveGrantId: this.googleDrive.createGrant(user.id, { email, encryptedRefreshToken: null }), email };
    }
    /* JUST FOR DEMO: END */

    throw realApiNotBuilt('dev-backup-drive');
  }

  /**
   * (Bản thật sẽ làm lại theo cách popup) Google chuyển về sau khi Admin đồng ý (hoặc bấm Hủy): lưu quyền, rồi về trang Sao lưu (lỗi thì kèm ?driveError=…).
   * @param code      mã Google gửi kèm (không có khi bấm Hủy)
   * @param state     phải trùng state trong cookie
   * @param error     Google gửi 'access_denied' khi bấm Hủy
   */
  @Get(BACKUP_ENDPOINTS.googleDriveCallback)
  @ApiFoundResponse({ description: 'Về trang Sao lưu; lỗi thì kèm driveError' })
  async finishGoogleDrive(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Query('error') error: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    // Cookie state chỉ dùng một lần
    const connectState = decodeDriveState(readCookie(request.headers.cookie, DRIVE_STATE_COOKIE_NAME));
    const { maxAge: _maxAge, ...clearOptions } = driveStateCookieOptions(this.appConfig.isDev);
    response.clearCookie(DRIVE_STATE_COOKIE_NAME, clearOptions);
    const backTo = (driveError?: DriveError) =>
      response.redirect(302, new URL(`/#${WEB_BACKUPS_HASH_PATH}${driveError ? `?${DRIVE_ERROR_PARAM}=${driveError}` : ''}`, this.appConfig.webBaseUrl).toString());

    // Bấm Hủy; state không khớp hoặc hết 10 phút; Google từ chối
    if (error === 'access_denied') return backTo('denied');
    if (!connectState || typeof code !== 'string' || !code || state !== connectState.state) return backTo('failed');
    return backTo((await this.googleDrive.finishConnect(connectState, code)) ? undefined : 'failed');
  }

  /**
   * Thêm một lịch định kì.
   * @throws  422 sai dạng, nơi lưu không có
   */
  @Post(BACKUP_ENDPOINTS.schedules)
  @ApiOkResponse({ schema: openApiSchemaOf(BackupsResponseSchema) })
  addSchedule(@Body() requestBody: unknown): Promise<BackupsResponse> {
    return this.backupsService.saveSchedule(parseOrReject(requestBody, BackupScheduleSchema));
  }

  /**
   * Sửa một lịch định kì.
   * @throws  422 sai dạng, nơi lưu không có · 404 không có lịch
   */
  @Put(BACKUP_ENDPOINTS.schedule)
  @ApiOkResponse({ schema: openApiSchemaOf(BackupsResponseSchema) })
  saveSchedule(@Param('scheduleId') scheduleId: string, @Body() requestBody: unknown): Promise<BackupsResponse> {
    return this.backupsService.saveSchedule(parseOrReject(requestBody, BackupScheduleSchema), scheduleId);
  }

  /**
   * Bỏ một lịch định kì.
   * @throws  404 không có lịch
   */
  @Delete(BACKUP_ENDPOINTS.schedule)
  @ApiOkResponse({ schema: openApiSchemaOf(BackupsResponseSchema) })
  removeSchedule(@Param('scheduleId') scheduleId: string): Promise<BackupsResponse> {
    return this.backupsService.removeSchedule(scheduleId);
  }

  /**
   * Sao lưu ngay vào các nơi đã chọn (chạy nền).
   * @throws  422 sai dạng · 404 có nơi lưu không còn · 409 đang chạy, Drive chưa kết nối
   */
  @Post(BACKUP_ENDPOINTS.run)
  @HttpCode(202)
  @ApiOkResponse({ schema: openApiSchemaOf(BackupRunSchema.array()) })
  run(@CurrentUser() starter: User, @Body() requestBody: unknown): Promise<BackupRun[]> {
    return this.backupsService.runNow(parseOrReject(requestBody, RunBackupRequestSchema).targetIds, starter);
  }

  /**
   * Sao lưu rồi tải thẳng về máy.
   * @throws  409 đang chạy · 500 không tạo được
   */
  @Post(BACKUP_ENDPOINTS.download)
  @HttpCode(200)
  async download(@CurrentUser() starter: User, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    return sendBackupFile(await this.backupsService.download(starter), response);
  }

  /**
   * Tải về một bản đã lưu ở thư mục trên máy chủ.
   * @throws  404 không có, hoặc tệp không còn
   */
  @Get(BACKUP_ENDPOINTS.runFile)
  async runFile(@Param('runId') runId: string, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    return sendBackupFile(await this.backupsService.runFile(runId), response);
  }
}
