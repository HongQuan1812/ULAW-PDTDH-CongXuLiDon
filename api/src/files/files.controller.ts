/* Nhóm API files: lấy nội dung tệp đính kèm để xem trước, tải về. */
import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { FILE_ENDPOINTS, FILE_MESSAGES } from '@ulaw/shared';
import type { Response } from 'express';
import { CurrentUser, RequireLogin } from '../auth/require-permission.decorator';
import { ApiException } from '../common/api-exception';
import type { User } from '../generated/prisma/client';
import { contentTypeOf } from './file-content-type';
import { FilesService } from './files.service';

@ApiTags('files')
@Controller()
export class FilesController {
  /** @param filesService  kiểm tra quyền xem và đọc tệp */
  constructor(private readonly filesService: FilesService) {}

  /**
   * Trả nội dung một tệp (không phải JSON).
   * @param viewer    người đang đăng nhập
   * @param fileId    id tệp
   * @param response  để đặt Content-Type và Content-Disposition
   * @returns         nội dung tệp
   * @throws          404 không có tệp hoặc không được xem (không nói rõ để không lộ tệp của người khác)
   */
  @Get(FILE_ENDPOINTS.content)
  @RequireLogin()
  @ApiOkResponse({ description: 'Nội dung tệp', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } })
  async content(@CurrentUser() viewer: User, @Param('fileId') fileId: string, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    const file = await this.filesService.findContent(fileId, viewer);
    if (!file) throw new ApiException(404, FILE_MESSAGES.notFound);

    response.setHeader('Content-Type', contentTypeOf(file.name));
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    return new StreamableFile(file.content);
  }
}
