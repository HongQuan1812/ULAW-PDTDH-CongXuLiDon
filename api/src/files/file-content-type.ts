/* Kiểu tệp (Content-Type) theo đuôi tên tệp, để trình duyệt xem trước đúng (PDF, ảnh, Word). */
import { extname } from 'node:path';

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Đoán kiểu tệp từ đuôi tên tệp.
 * @param fileName  tên tệp, vd 'Bang_diem.PDF'
 * @returns         vd 'application/pdf'; đuôi lạ thì 'application/octet-stream'
 */
export function contentTypeOf(fileName: string): string {
  return CONTENT_TYPE_BY_EXTENSION[extname(fileName).toLowerCase()] ?? 'application/octet-stream';
}
