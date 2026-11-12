/* Đọc tệp đính kèm: kiểm tra quyền xem rồi lấy nội dung từ ổ đĩa máy chủ. */
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { buildSamplePdfText, can } from '@ulaw/shared';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../common/prisma.service';
import type { User } from '../generated/prisma/client';

/** Một tệp sẵn sàng trả về: tên và nội dung. */
export interface StoredFileContent {
  name: string;
  content: Buffer;
}

@Injectable()
export class FilesService {
  /**
   * @param prisma  đọc bảng tệp và đơn
   * @param config  cho biết thư mục lưu tệp
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
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

    const absolutePath = this.resolveInUploadDir(file.storagePath);
    if (!absolutePath) return null;
    try {
      return { name: file.name, content: await readFile(absolutePath) };
    } catch {
      // Tệp có trong database nhưng mất trên ổ đĩa: coi như không có
      return null;
    }
  }

  /**
   * Ghép đường dẫn lưu trong database với thư mục tệp, từ chối đường dẫn chui ra ngoài thư mục.
   * @param storagePath  đường dẫn tương đối trong thư mục tệp
   * @returns            đường dẫn tuyệt đối; nằm ngoài thư mục thì null
   */
  private resolveInUploadDir(storagePath: string): string | null {
    const uploadRoot = resolve(this.config.uploadDir);
    const absolutePath = resolve(uploadRoot, storagePath);
    const fromRoot = relative(uploadRoot, absolutePath);
    return fromRoot && !fromRoot.startsWith('..') && !isAbsolute(fromRoot) ? absolutePath : null;
  }
}
