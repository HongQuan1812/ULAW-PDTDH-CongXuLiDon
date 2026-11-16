/* Nhóm API Sao lưu: tổng quan, nơi lưu, kết nối Google Drive, lịch định kì, sao lưu ngay, tải về. Mọi lệnh cần quyền manageBackups.
   Các lệnh trả tệp gửi .tar.gz, tên tệp trong Content-Disposition. */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
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
  DRIVE_CONNECT_MESSAGE_TYPE,
  RunBackupRequestSchema,
  parseListQuery,
  type BackupRun,
  type BackupRunsResponse,
  type BackupTarget,
  type BackupsResponse,
  type ConnectGoogleDriveResponse,
  type DriveConnectMessage,
} from '@ulaw/shared';
import type { ZodType } from 'zod';
import { CurrentUser, RequirePermission } from '../auth/require-permission.decorator';
import { readCookie } from '../auth/session-cookie';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import { AppConfig } from '../config/app-config';
import type { User } from '../generated/prisma/client';
import { BackupsService, type BackupDownload } from './backups.service';
import { driveConnectPage } from './drive-connect-page';
import { DRIVE_STATE_COOKIE_NAME, GoogleDriveBackupService, decodeDriveState, driveStateCookieOptions, encodeDriveState } from './google-drive-backup.service';

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
   * Bản thật: đặt cookie state (state, mã PKCE, người bấm), trả đường dẫn sang Google để giao diện mở trong popup.
   * @param user         người đang đăng nhập (chỉ người này dùng được driveGrantId)
   * @param requestBody  ConnectGoogleDriveRequest
   * @param response     để đặt cookie state
   * @returns            bản giả: 'connected' kèm driveGrantId, email · bản thật: 'redirect' kèm đường dẫn sang Google
   * @throws             422 email sai dạng · 503 máy chủ chưa cấu hình Google
   */
  @Post(BACKUP_ENDPOINTS.driveConnect)
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchemaOf(ConnectGoogleDriveResponseSchema) })
  connectGoogleDrive(@CurrentUser() user: User, @Body() requestBody: unknown, @Res({ passthrough: true }) response: Response): ConnectGoogleDriveResponse {
    const connectRequest = parseOrReject(requestBody ?? {}, ConnectGoogleDriveRequestSchema);

    /* JUST FOR DEMO: START · bản giả dev-google-drive-connect: không qua Google, tài khoản là email gửi kèm (mặc định email người đang đăng nhập),
       không có refresh token nên sao lưu vào đó báo lỗi trong lịch sử. Bản thật: trả 'redirect' sang Google (popup), callback báo driveGrantId */
    if (this.appConfig.usesDemoApi('dev-google-drive-connect')) {
      const email = connectRequest.email ?? user.email;
      return { kind: 'connected', driveGrantId: this.googleDrive.createGrant(user.id, { email, encryptedRefreshToken: null }), email };
    }
    /* JUST FOR DEMO: END */

    const started = this.googleDrive.startConnect(user.id);
    if (!started) throw new ApiException(503, BACKUP_MESSAGES.driveUnavailable);
    response.cookie(DRIVE_STATE_COOKIE_NAME, encodeDriveState(started.connectState), driveStateCookieOptions(this.appConfig.isDev));
    return { kind: 'redirect', url: started.url };
  }

  /**
   * Google chuyển về (trong popup) sau khi Admin chọn tài khoản, đồng ý hoặc bấm Hủy: đổi code lấy quyền, giữ thành driveGrantId,
   * rồi trả trang nhỏ gửi kết quả cho hộp thoại và tự đóng. Không gọi từ giao diện.
   * @param user      người đang đăng nhập (phải là người đã bấm Kết nối)
   * @param code      mã Google gửi kèm (không có khi bấm Hủy)
   * @param state     phải trùng state trong cookie
   * @param error     Google gửi 'access_denied' khi bấm Hủy
   * @param request   để đọc cookie state
   * @param response  để xóa cookie state, gửi trang
   */
  @Get(BACKUP_ENDPOINTS.googleDriveCallback)
  @ApiProduces('text/html')
  @ApiOkResponse({ description: 'Trang nhỏ gửi DriveConnectMessage cho hộp thoại rồi tự đóng' })
  async finishGoogleDrive(
    @CurrentUser() user: User,
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

    // Bấm Hủy; state không khớp, hết 10 phút hoặc người khác; Google từ chối
    const message = await (async (): Promise<DriveConnectMessage> => {
      const failed = (driveError: 'denied' | 'failed'): DriveConnectMessage => ({ type: DRIVE_CONNECT_MESSAGE_TYPE, ok: false, error: driveError });
      if (error === 'access_denied') return failed('denied');
      if (!connectState || typeof code !== 'string' || !code || state !== connectState.state || connectState.userId !== user.id) return failed('failed');
      const connected = await this.googleDrive.finishConnect(connectState, code);
      return connected ? { type: DRIVE_CONNECT_MESSAGE_TYPE, ok: true, ...connected } : failed('failed');
    })();

    // Trang gửi kết quả; không lưu cache, chỉ chạy đúng script của trang
    const page = driveConnectPage(message, new URL(this.appConfig.webBaseUrl).origin);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', page.contentSecurityPolicy);
    response.status(200).send(page.html);
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
