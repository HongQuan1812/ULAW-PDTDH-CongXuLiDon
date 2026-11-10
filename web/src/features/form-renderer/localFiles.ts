/* Tệp người nộp đơn vừa chọn, chưa tải lên máy chủ.
   Câu trả lời của câu hỏi tải tệp chỉ lưu FileRef (id, tên, dung lượng); nội dung tệp giữ ở đây theo id,
   để lúc bấm Gửi đơn gửi kèm cùng câu trả lời, hoặc để xem lại tệp trước khi gửi. Tải lại trang thì mất. */
import type { FileRef } from '@ulaw/shared';

/** Tiền tố id của tệp chưa tải lên, để phân biệt với tệp đã có ở máy chủ. */
export const LOCAL_FILE_ID_PREFIX = 'local-';

const localFiles = new Map<string, File>();

/**
 * Giữ một tệp vừa chọn.
 * @param file  tệp người dùng chọn hoặc kéo thả vào
 * @returns     FileRef có id dạng 'local-…', dùng làm câu trả lời
 */
export function keepLocalFile(file: File): FileRef {
  const id = `${LOCAL_FILE_ID_PREFIX}${crypto.randomUUID()}`;
  localFiles.set(id, file);
  return { id, name: file.name, sizeBytes: file.size };
}

/**
 * Lấy lại nội dung một tệp vừa chọn.
 * @param fileId  id trong FileRef
 * @returns       tệp; không có (tệp đã ở máy chủ, hoặc đã tải lại trang) thì undefined
 */
export function readLocalFile(fileId: string): File | undefined {
  return localFiles.get(fileId);
}
