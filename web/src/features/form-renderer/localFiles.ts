/* Tệp người nộp đơn vừa chọn, chưa tải lên máy chủ.
   Câu trả lời của câu hỏi tải tệp chỉ lưu FileRef (id, tên, dung lượng); nội dung tệp giữ ở đây theo id,
   để lúc bấm Gửi đơn / Lưu thay đổi gửi kèm cùng câu trả lời, hoặc để xem lại tệp trước khi gửi. Tải lại trang thì mất. */
import { ANSWER_MESSAGES, type FileRef, type FormAnswers, type FormSection } from '@ulaw/shared';

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

/**
 * Lấy nội dung mọi tệp vừa chọn trong câu trả lời, để gửi kèm. Tệp đã ở máy chủ (sửa đơn) thì không gửi lại.
 * @param sections  các phần của loại đơn
 * @param answers   câu trả lời trên trang
 * @returns         tệp theo id tạm; tệp vừa chọn mà không còn trong trình duyệt (vd đã tải lại trang) thì ném lỗi, không gửi gì
 */
export function collectLocalFiles(sections: readonly FormSection[], answers: FormAnswers): Map<string, File> {
  const filesByTempId = new Map<string, File>();
  sections
    .flatMap((section) => section.questions)
    .filter((question) => question.type === 'file')
    .forEach((question) => {
      const files = Array.isArray(answers[question.id]) ? (answers[question.id] as FileRef[]) : [];
      files
        .filter((file) => file.id.startsWith(LOCAL_FILE_ID_PREFIX))
        .forEach((file) => {
          const content = readLocalFile(file.id);
          if (!content) throw new Error(ANSWER_MESSAGES.fileMissing(file.name));
          filesByTempId.set(file.id, content);
        });
    });
  return filesByTempId;
}
