/* Nhóm API form-notes: ghi chú nội bộ của cán bộ trên lá đơn (xem, thêm, sửa, xóa, đếm). Mọi lệnh cần quyền internalNotes. */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  FORM_NOTE_COUNTS_PARAM,
  FORM_NOTE_ENDPOINTS,
  FORM_NOTE_MESSAGES,
  FormNoteCountsResponseSchema,
  FormNoteSchema,
  FormNotesResponseSchema,
  SaveFormNoteRequestSchema,
  parseFormNoteCountsParam,
  type FormNote,
  type FormNoteCountsResponse,
  type FormNotesResponse,
  type SaveFormNoteRequest,
} from '@ulaw/shared';
import { CurrentUser, RequirePermission } from '../auth/require-permission.decorator';
import { ApiException } from '../common/api-exception';
import { openApiSchemaOf } from '../common/swagger';
import type { User } from '../generated/prisma/client';
import { FormNotesService } from './form-notes.service';

/**
 * Kiểm tra body thêm / sửa ghi chú, giống API giả.
 * @param requestBody  body chưa kiểm tra
 * @returns            body đã kiểm tra
 * @throws             422 nội dung trống (câu riêng), hoặc sai dạng
 */
function readNoteBody(requestBody: unknown): SaveFormNoteRequest {
  const parsed = SaveFormNoteRequestSchema.safeParse(requestBody);
  if (parsed.success) return parsed.data;
  const emptyContent = parsed.error.issues.some((issue) => issue.message === FORM_NOTE_MESSAGES.empty);
  throw new ApiException(422, emptyContent ? FORM_NOTE_MESSAGES.empty : FORM_NOTE_MESSAGES.invalidRequest);
}

@ApiTags('form-notes')
@Controller()
@RequirePermission('internalNotes', FORM_NOTE_MESSAGES[403])
export class FormNotesController {
  /** @param formNotesService  đọc, ghi ghi chú */
  constructor(private readonly formNotesService: FormNotesService) {}

  /**
   * Số ghi chú của nhiều đơn (?codes=<mã>,<mã>…).
   * @returns  số ghi chú theo mã đơn, đủ mọi mã đã hỏi
   */
  @Get(FORM_NOTE_ENDPOINTS.counts)
  @ApiOkResponse({ schema: openApiSchemaOf(FormNoteCountsResponseSchema) })
  async counts(@Query(FORM_NOTE_COUNTS_PARAM) codesParam?: string): Promise<FormNoteCountsResponse> {
    return { counts: await this.formNotesService.countNotes(parseFormNoteCountsParam(codesParam ?? null)) };
  }

  /**
   * Các ghi chú của lá đơn, cũ trước mới sau.
   * @throws  404 không có đơn
   */
  @Get(FORM_NOTE_ENDPOINTS.list)
  @ApiOkResponse({ schema: openApiSchemaOf(FormNotesResponseSchema) })
  list(@Param('code') code: string): Promise<FormNotesResponse> {
    return this.formNotesService.findNotes(code);
  }

  /**
   * Thêm ghi chú; người viết là người đang đăng nhập.
   * @returns  ghi chú mới (201)
   * @throws   404 không có đơn · 422 nội dung trống, sai dạng
   */
  @Post(FORM_NOTE_ENDPOINTS.list)
  @ApiCreatedResponse({ schema: openApiSchemaOf(FormNoteSchema) })
  add(@CurrentUser() author: User, @Param('code') code: string, @Body() requestBody: unknown): Promise<FormNote> {
    return this.formNotesService.addNote(code, readNoteBody(requestBody).content, author);
  }

  /**
   * Sửa nội dung ghi chú của mình.
   * @returns  ghi chú sau khi sửa
   * @throws   404 không có đơn, ghi chú · 403 không phải người viết · 422 nội dung trống, sai dạng
   */
  @Patch(FORM_NOTE_ENDPOINTS.note)
  @ApiOkResponse({ schema: openApiSchemaOf(FormNoteSchema) })
  async edit(@CurrentUser() editor: User, @Param('code') code: string, @Param('noteId') noteId: string, @Body() requestBody: unknown): Promise<FormNote> {
    const { content } = readNoteBody(requestBody);
    return this.formNotesService.updateNote(code, noteId, content, editor);
  }

  /**
   * Xóa ghi chú của mình.
   * @throws  404 không có đơn, ghi chú · 403 không phải người viết
   */
  @Delete(FORM_NOTE_ENDPOINTS.note)
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@CurrentUser() editor: User, @Param('code') code: string, @Param('noteId') noteId: string): Promise<void> {
    return this.formNotesService.deleteNote(code, noteId, editor);
  }
}
