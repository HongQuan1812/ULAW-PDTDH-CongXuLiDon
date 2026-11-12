/* Đọc tệp đính kèm: kiểm tra quyền xem rồi lấy nội dung từ ổ đĩa máy chủ. */
import { Injectable } from '@nestjs/common';
import { buildSamplePdfText, can } from '@ulaw/shared';
import { PrismaService } from '../common/prisma.service';
import type { User } from '../generated/prisma/client';
import { FileStorageService } from './file-storage.service';

/** Một tệp sẵn sàng trả về: tên và nội dung. */
export interface StoredFileContent {
  name: string;
  content: Buffer;
}

@Injectable()
export class FilesService {
  /**
   * @param prisma  đọc bảng tệp và đơn
   * @param storage  đọc nội dung tệp trên ổ đĩa
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
  ) {}

  /**
   * Lấy nội dung một tệp nếu người xem được phép: người nộp đơn chứa tệp, hoặc cán bộ có quyền viewAll.
   * Tệp mẫu của seed (không có nội dung thật) thì dựng một PDF ghi tên tệp.
   * @param fileId  id tệp
   * @param viewer  người đang đăng nhập
   * @returns       tên và nội dung; không có tệp, không được xem, hoặc mất nội dung trên ổ đĩa thì null
   */
  async findContent(fileId: string, viewer: User): Promise<StoredFileContent | null> {
    const file = await this.prisma.fileObject.findUnique({ where: { id: fileId }, include: { form: { select: { ownerId: true } } } });
    if (!file?.form) return null;
    if (file.form.ownerId !== viewer.id && !can(viewer.role, 'viewAll')) return null;

    // Tệp mẫu: chưa có nội dung thật
    if (file.storagePath === null) return { name: file.name, content: Buffer.from(buildSamplePdfText(file.name), 'latin1') };

    // Tệp có trong database nhưng mất trên ổ đĩa: coi như không có
    const content = await this.storage.read(file.storagePath);
    return content ? { name: file.name, content } : null;
  }
}
