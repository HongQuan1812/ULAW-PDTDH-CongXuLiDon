/* Nhóm API exports: mẫu xuất file của loại đơn, xuất file một lá đơn (Word) và xuất file thống kê (Excel).
   Xem danh sách mẫu, xuất file một lá đơn chỉ cần đăng nhập; mọi lệnh quản lí mẫu và xuất thống kê cần quyền manageFormTypes.
   Các lệnh trả file (mẫu gốc, xuất file) trả nội dung .docx / .xlsx, tên file trong Content-Disposition. */
import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, Res, StreamableFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  DOCX_CONTENT_TYPE,
  EXPORT_ENDPOINTS,
  EXPORT_MESSAGES,
  EXPORT_TEMPLATE_FIELDS,
  ExportDraftRequestSchema,
  ExportFormRequestSchema,
  ExportTemplateCheckSchema,
  ExportTemplatesResponseSchema,
  SaveExportTemplatesRequestSchema,
  XLSX_CONTENT_TYPE,
  type ExportTemplateCheck,
  type ExportTemplatesResponse,
} from '@ulaw/shared';
import type { Request, Response } from 'express';
import type { ZodType } from 'zod';
import { CurrentUser, RequireLogin, RequirePermission } from '../auth/require-permission.decorator';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import type { User } from '../generated/prisma/client';
import { ExportsService, type DownloadFile, type UploadedTemplateFile } from './exports.service';

/** File multer đưa vào bộ nhớ (chỉ các trường dùng tới; tránh phụ thuộc @types/multer). */
interface MulterFile {
  fieldname: string;
  originalname: string;
  buffer: Buffer;
}

/** Dung lượng tối đa của một file mẫu. */
const MAX_TEMPLATE_BYTES = 20 * 1024 * 1024;

/**
 * Mô tả Swagger cho các lệnh trả file.
 * @param description  mô tả, vd 'File Word .docx'
 * @param contentTypes  các kiểu nội dung có thể trả
 * @returns             tùy chọn của ApiOkResponse
 */
function fileResponse(description: string, contentTypes: string[]) {
  return { description, content: Object.fromEntries(contentTypes.map((contentType) => [contentType, { schema: { type: 'string', format: 'binary' } }])) };
}

/**
 * Kiểm tra dữ liệu theo schema.
 * @param input   dữ liệu chưa kiểm tra (body JSON, hoặc chuỗi JSON trong trường multipart đã đọc)
 * @param schema  schema cần khớp
 * @returns       dữ liệu đã kiểm tra
 * @throws        422 sai dạng
 */
function parseOrReject<Output>(input: unknown, schema: ZodType<Output>): Output {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ApiException(422, EXPORT_MESSAGES.invalidRequest);
  return parsed.data;
}

/**
 * Đọc chuỗi JSON trong một trường chữ của body multipart.
 * @param request    request gốc
 * @param fieldName  tên trường
 * @returns          dữ liệu đã đọc; không có trường, hoặc không phải chuỗi JSON hợp lệ thì null
 */
function jsonFieldOf(request: Request, fieldName: string): unknown {
  const fieldText = (request.body as Record<string, unknown> | undefined)?.[fieldName];
  if (typeof fieldText !== 'string') return null;
  try {
    return JSON.parse(fieldText);
  } catch {
    return null;
  }
}

/**
 * Gom các file multer theo tên trường.
 * Multer đọc tên file theo latin1; trình duyệt gửi UTF-8, nên đổi lại để chữ có dấu không bị vỡ.
 * @param files  các file multer đã nhận
 * @returns      file theo tên trường
 */
function uploadsByField(files: readonly MulterFile[]): Map<string, UploadedTemplateFile> {
  return new Map(files.map((file) => [file.fieldname, { fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'), content: file.buffer }]));
}

/**
 * Đặt header tải về và trả nội dung file.
 * @param downloadFile  tên file, kiểu nội dung, nội dung
 * @param response      để đặt Content-Type và Content-Disposition
 * @returns             nội dung để NestJS gửi đi
 */
function sendFile(downloadFile: DownloadFile, response: Response): StreamableFile {
  response.setHeader('Content-Type', downloadFile.contentType);
  response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadFile.fileName)}`);
  return new StreamableFile(downloadFile.content);
}

@ApiTags('exports')
@Controller()
export class ExportsController {
  /** @param exportsService  đọc, lưu, kiểm tra, điền mẫu */
  constructor(private readonly exportsService: ExportsService) {}

  /** @returns  các mẫu của loại đơn (nút Xuất file ở trang chi tiết đơn, các khung mẫu xuất file) */
  @Get(EXPORT_ENDPOINTS.templates)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(ExportTemplatesResponseSchema) })
  list(@Param('formTypeId') formTypeId: string): Promise<ExportTemplatesResponse> {
    return this.exportsService.findTemplates(formTypeId);
  }

  /**
   * Lưu các thay đổi về mẫu (multipart/form-data: trường changes là chuỗi JSON, mỗi file mới một trường tên bằng id tạm).
   * @returns  các mẫu sau khi lưu
   * @throws   404 không có loại đơn, mẫu không còn · 422 sai dạng, thiếu file, sai loại file, không đọc được
   */
  @Put(EXPORT_ENDPOINTS.templates)
  @RequirePermission('manageFormTypes', EXPORT_MESSAGES[403])
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: MAX_TEMPLATE_BYTES } }))
  @ApiOkResponse({ schema: openApiSchemaOf(ExportTemplatesResponseSchema) })
  async save(
    @CurrentUser() staff: User,
    @Param('formTypeId') formTypeId: string,
    @Req() request: Request,
    @UploadedFiles() files: MulterFile[] = [],
  ): Promise<ExportTemplatesResponse> {
    await this.exportsService.assertFormTypeExists(formTypeId);
    const changes = parseOrReject(jsonFieldOf(request, EXPORT_TEMPLATE_FIELDS.changes), SaveExportTemplatesRequestSchema);
    return this.exportsService.saveTemplates(formTypeId, changes, uploadsByField(files), staff);
  }

  /**
   * Mẫu gốc còn nguyên các mã (nút Xem mẫu).
   * @returns  nội dung file .docx / .xlsx
   * @throws   404 không có loại đơn, mẫu
   */
  @Get(EXPORT_ENDPOINTS.templateFile)
  @RequirePermission('manageFormTypes', EXPORT_MESSAGES[403])
  @ApiOkResponse(fileResponse('File Word .docx hoặc Excel .xlsx', [DOCX_CONTENT_TYPE, XLSX_CONTENT_TYPE]))
  async templateFile(
    @Param('formTypeId') formTypeId: string,
    @Param('templateId') templateId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    await this.exportsService.assertFormTypeExists(formTypeId);
    return sendFile(await this.exportsService.findTemplateFile(formTypeId, templateId), response);
  }

  /**
   * Kiểm tra mã trong một mẫu đã lưu theo bản soạn hiện tại (chưa lưu cũng được).
   * @returns  kết quả kiểm tra
   * @throws   404 không có loại đơn, mẫu · 422 bản soạn sai dạng
   */
  @Post(EXPORT_ENDPOINTS.templateCheck)
  @HttpCode(200)
  @RequirePermission('manageFormTypes', EXPORT_MESSAGES[403])
  @ApiOkResponse({ schema: openApiSchemaOf(ExportTemplateCheckSchema) })
  async checkTemplate(
    @Param('formTypeId') formTypeId: string,
    @Param('templateId') templateId: string,
    @Body() requestBody: unknown,
  ): Promise<ExportTemplateCheck> {
    await this.exportsService.assertFormTypeExists(formTypeId);
    const draft = parseOrReject(requestBody, ExportDraftRequestSchema);
    return this.exportsService.checkSavedTemplate(formTypeId, templateId, draft.sections);
  }

  /**
   * Kiểm tra mã trong file mẫu chưa lưu (multipart/form-data: file ở trường file, bản soạn dạng chuỗi JSON ở trường draft).
   * @returns  kết quả kiểm tra; file không được lưu lại
   * @throws   422 sai dạng, thiếu file, không phải .docx / .xlsx đọc được
   */
  @Post(EXPORT_ENDPOINTS.fileCheck)
  @HttpCode(200)
  @RequirePermission('manageFormTypes', EXPORT_MESSAGES[403])
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: MAX_TEMPLATE_BYTES } }))
  @ApiOkResponse({ schema: openApiSchemaOf(ExportTemplateCheckSchema) })
  checkFile(@Req() request: Request, @UploadedFiles() files: MulterFile[] = []): Promise<ExportTemplateCheck> {
    const draft = parseOrReject(jsonFieldOf(request, EXPORT_TEMPLATE_FIELDS.draft), ExportDraftRequestSchema);
    const upload = uploadsByField(files).get(EXPORT_TEMPLATE_FIELDS.file);
    if (!upload) throw new ApiException(422, EXPORT_MESSAGES.invalidRequest);
    return this.exportsService.checkUploadedTemplate(upload, draft.sections);
  }

  /**
   * Điền dữ liệu của lá đơn vào một mẫu xuất file đơn của loại đơn đó (nút Xuất file).
   * @returns  nội dung file .docx đã điền
   * @throws   404 không có đơn / không được xem, không có mẫu · 422 body sai dạng, mẫu sai cú pháp
   */
  @Post(EXPORT_ENDPOINTS.formExport)
  @HttpCode(200)
  @RequireLogin()
  @ApiOkResponse(fileResponse('File Word .docx', [DOCX_CONTENT_TYPE]))
  async exportForm(
    @CurrentUser() viewer: User,
    @Param('code') code: string,
    @Body() requestBody: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { templateId } = parseOrReject(requestBody, ExportFormRequestSchema);
    return sendFile(await this.exportsService.exportForm(code, templateId, viewer), response);
  }

  /**
   * So mã trong một mẫu xuất file đơn với các câu hỏi của lá đơn này (hiện trong hộp "Chọn mẫu" của nút Xuất file).
   * @returns  kết quả kiểm tra
   * @throws   404 không có đơn / không được xem, không có mẫu · 422 body sai dạng
   */
  @Post(EXPORT_ENDPOINTS.formExportCheck)
  @HttpCode(200)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(ExportTemplateCheckSchema) })
  async checkFormExport(@CurrentUser() viewer: User, @Param('code') code: string, @Body() requestBody: unknown): Promise<ExportTemplateCheck> {
    const { templateId } = parseOrReject(requestBody, ExportFormRequestSchema);
    return this.exportsService.checkTemplateForForm(code, templateId, viewer);
  }

  /**
   * Điền mọi lá đơn của loại đơn vào một mẫu xuất file thống kê (nút Xuất ở khung Mẫu xuất file thống kê).
   * @returns  nội dung file .xlsx đã điền
   * @throws   404 không có loại đơn, không có mẫu thống kê · 422 không đọc được mẫu
   */
  @Post(EXPORT_ENDPOINTS.statsExport)
  @HttpCode(200)
  @RequirePermission('manageFormTypes', EXPORT_MESSAGES[403])
  @ApiOkResponse(fileResponse('File Excel .xlsx', [XLSX_CONTENT_TYPE]))
  async exportStats(
    @Param('formTypeId') formTypeId: string,
    @Param('templateId') templateId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    await this.exportsService.assertFormTypeExists(formTypeId);
    return sendFile(await this.exportsService.exportStats(formTypeId, templateId), response);
  }
}
