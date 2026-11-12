/* Lưu, đọc, xóa tệp trên ổ đĩa máy chủ (thư mục UPLOAD_DIR). Database chỉ giữ đường dẫn tương đối trong thư mục đó. */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config';

@Injectable()
export class FileStorageService {
  /** @param config  cho biết thư mục lưu tệp */
  constructor(private readonly config: AppConfig) {}

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

  /**
   * Lưu nội dung một tệp mới dưới tên ngẫu nhiên (giữ đuôi tệp), để tên người dùng đặt không ảnh hưởng đường dẫn trên ổ đĩa.
   * @param content   nội dung tệp
   * @param fileName  tên tệp người dùng đặt, vd 'Bảng điểm.pdf' (chỉ lấy đuôi)
   * @returns         đường dẫn tương đối để lưu vào database
   */
  async save(content: Buffer, fileName: string): Promise<string> {
    const extension = extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const storagePath = `${randomUUID()}${extension}`;
    const absolutePath = this.resolveInUploadDir(storagePath)!;
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
    return storagePath;
  }

  /**
   * Đọc nội dung một tệp đã lưu.
   * @param storagePath  đường dẫn tương đối lấy từ database
   * @returns            nội dung; đường dẫn chui ra ngoài thư mục, hoặc tệp mất trên ổ đĩa, thì null
   */
  async read(storagePath: string): Promise<Buffer | null> {
    const absolutePath = this.resolveInUploadDir(storagePath);
    if (!absolutePath) return null;
    try {
      return await readFile(absolutePath);
    } catch {
      return null;
    }
  }

  /**
   * Xóa hẳn một tệp khỏi ổ đĩa. Không có tệp thì bỏ qua.
   * @param storagePath  đường dẫn tương đối lấy từ database
   */
  async remove(storagePath: string): Promise<void> {
    const absolutePath = this.resolveInUploadDir(storagePath);
    if (absolutePath) await rm(absolutePath, { force: true });
  }
}
