/* Nhóm API form: nộp đơn, chi tiết, sửa. Tiếp nhận, quyết định, chuyển giao ở bước xử lí đơn.
   Module này phải đứng SAU FormsModule trong app.module để /forms/mine… không bị hiểu nhầm là mã đơn của /forms/:code. */
import { Controller, Get, Param, Post, Put, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  FORM_ENDPOINTS,
  FORM_MESSAGES,
  FormDetailSchema,
  FormSummarySchema,
  SUBMIT_FORM_FIELDS,
  SubmitFormRequestSchema,
  UpdateFormRequestSchema,
  type FormDetail,
  type FormSummary,
} from '@ulaw/shared';
import type { Request } from 'express';
import type { ZodType } from 'zod';
import { CurrentUser, RequireLogin } from '../auth/require-permission.decorator';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import type { User } from '../generated/prisma/client';
import { FormService, type UploadedPart } from './form.service';

/** Tệp multer đưa vào bộ nhớ (chỉ các trường dùng tới; tránh phụ thuộc @types/multer). */
interface MulterFile {
  fieldname: string;
  originalname: string;
  buffer: Buffer;
}

/** Dung lượng tối đa của mọi tệp trong một lần gửi, chặn sớm trước khi kiểm tra theo từng câu hỏi (maxMB). */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/**
 * Tách phần chữ (chuỗi JSON) và các tệp của body multipart.
 * Multer đọc tên tệp theo latin1; trình duyệt gửi UTF-8, nên đổi lại để chữ có dấu không bị vỡ.
 * @param request  request gốc (trường request chứa chuỗi JSON)
 * @param files    các tệp multer đã nhận
 * @param schema   schema của phần chữ
 * @returns        phần chữ đã kiểm tra và tệp theo id tạm
 * @throws         422 phần chữ thiếu, hỏng hoặc sai dạng
 */
function readSubmission<Body>(request: Request, files: MulterFile[], schema: ZodType<Body>): { body: Body; uploads: Map<string, UploadedPart> } {
  const requestText = (request.body as Record<string, unknown> | undefined)?.[SUBMIT_FORM_FIELDS.request];
  let jsonValue: unknown = null;
  try {
    jsonValue = typeof requestText === 'string' ? JSON.parse(requestText) : null;
  } catch {
    jsonValue = null;
  }
  const parsed = schema.safeParse(jsonValue);
  if (!parsed.success) throw new ApiException(422, FORM_MESSAGES.invalidBody);
  const uploads = new Map(files.map((file) => [file.fieldname, { name: Buffer.from(file.originalname, 'latin1').toString('utf8'), content: file.buffer }]));
  return { body: parsed.data, uploads };
}

@ApiTags('form')
@Controller()
export class FormController {
  /** @param formService  nộp, đọc, sửa lá đơn */
  constructor(private readonly formService: FormService) {}

  /**
   * Nộp đơn mới (multipart/form-data: trường request chứa JSON, mỗi tệp một trường tên bằng id tạm).
   * @returns  dòng tóm tắt của đơn mới (201)
   * @throws   403 thiếu quyền submit / submitForApplicant · 404 không có người nộp, hoặc loại đơn không nhận đơn · 422 body, câu trả lời hoặc tệp sai
   */
  @Post(FORM_ENDPOINTS.submit)
  @RequireLogin()
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiCreatedResponse({ schema: openApiSchemaOf(FormSummarySchema) })
  async submit(@CurrentUser() submitter: User, @Req() request: Request, @UploadedFiles() files: MulterFile[] = []): Promise<FormSummary> {
    return this.formService.submit(submitter, () => readSubmission(request, files, SubmitFormRequestSchema));
  }

  /**
   * Chi tiết một lá đơn.
   * @returns  theo FormDetailSchema
   * @throws   404 không có đơn, hoặc không được xem
   */
  @Get(FORM_ENDPOINTS.detail)
  @RequireLogin()
  @ApiOkResponse({ schema: openApiSchemaOf(FormDetailSchema) })
  detail(@CurrentUser() viewer: User, @Param('code') code: string): Promise<FormDetail> {
    return this.formService.findDetail(code, viewer);
  }

  /**
   * Sửa nội dung đơn (multipart/form-data, cách gửi như nộp đơn).
   * @returns  lá đơn sau khi lưu
   * @throws   404 không xem được đơn · 403 không có quyền sửa · 409 đơn đã khóa · 422 body, câu trả lời hoặc tệp sai
   */
  @Put(FORM_ENDPOINTS.update)
  @RequireLogin()
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiOkResponse({ schema: openApiSchemaOf(FormDetailSchema) })
  async update(
    @CurrentUser() editor: User,
    @Param('code') code: string,
    @Req() request: Request,
    @UploadedFiles() files: MulterFile[] = [],
  ): Promise<FormDetail> {
    return this.formService.update(editor, code, () => readSubmission(request, files, UpdateFormRequestSchema));
  }
}
