/* Ô trả lời tải tệp (như QUESTION_UI.file của artifact/js/sections.js). */
import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { acceptedExtensions, acceptedExtensionsText, formatFileSize, validateFile, type FileRef } from '@ulaw/shared';
import type { AnswerProps } from './answerProps';
import { keepLocalFile } from './localFiles';
import styles from './FormRenderer.module.css';

/** Kiểu tệp (MIME) theo đuôi tệp, để hộp chọn tệp của máy lọc đúng loại. */
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Đọc câu trả lời thành danh sách tệp.
 * @param answerValue  câu trả lời đã lưu
 * @returns            các tệp; câu trả lời không phải danh sách tệp thì []
 */
function readFiles(answerValue: unknown): FileRef[] {
  if (!Array.isArray(answerValue)) return [];
  return answerValue.filter(
    (file): file is FileRef => typeof file === 'object' && file !== null && 'id' in file && 'name' in file,
  );
}

/**
 * Đuôi tệp để ghi trên nhãn nhỏ cạnh tên tệp.
 * @param fileName  tên tệp, vd 'bang-diem.pdf'
 * @returns         vd 'PDF'
 */
function fileExtensionLabel(fileName: string): string {
  return fileName.includes('.') ? fileName.split('.').pop()!.toUpperCase() : 'TỆP';
}

/**
 * Tải tệp: bấm hoặc kéo thả vào khung để chọn; tệp sai định dạng hoặc quá dung lượng bị bỏ và báo ngay.
 * Chỉ xem: chỉ có danh sách tệp.
 * Câu trả lời lưu: các tệp (FileRef). Tệp vừa chọn giữ trong trình duyệt (localFiles.ts), tải lên khi gửi đơn.
 * @returns  khung chọn tệp, danh sách tệp, câu báo tệp bị bỏ
 */
export function FileAnswer({
  question,
  answerValue,
  onAnswerChange,
  readOnly,
  invalid,
  labelId,
  describedBy,
}: AnswerProps<'file'>) {
  const files = readFiles(answerValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const rejectedId = useId();
  const [rejectedMessages, setRejectedMessages] = useState<string[]>([]);
  const [draggingOver, setDraggingOver] = useState(false);

  /**
   * Thêm các tệp vừa chọn: bỏ tệp sai định dạng / quá dung lượng (ghi lí do), bỏ tệp trùng tên đã có.
   * @param chosenFiles  tệp từ hộp chọn tệp hoặc kéo thả
   */
  const addFiles = (chosenFiles: FileList | null) => {
    if (!chosenFiles?.length) return;
    const messages: string[] = [];
    const addedFiles: FileRef[] = [];
    Array.from(chosenFiles).forEach((file) => {
      const message = validateFile(question, file.name, file.size);
      if (message) messages.push(message);
      else if (![...files, ...addedFiles].some((existing) => existing.name === file.name)) addedFiles.push(keepLocalFile(file));
    });
    setRejectedMessages(messages);
    if (addedFiles.length) onAnswerChange([...files, ...addedFiles]);
  };

  /**
   * Gỡ một tệp khỏi câu trả lời.
   * @param fileId  id tệp cần gỡ
   */
  const removeFile = (fileId: string) => onAnswerChange(files.filter((file) => file.id !== fileId));

  // Kéo tệp vào / ra khỏi khung chọn tệp
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingOver(true);
  };
  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingOver(false);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingOver(false);
    addFiles(event.dataTransfer.files);
  };
  // Enter hoặc phím cách trên khung: mở hộp chọn tệp
  const onDropZoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    inputRef.current?.click();
  };

  const extensions = acceptedExtensions(question);
  const acceptAttribute = [
    ...extensions.map((extension) => `.${extension}`),
    ...extensions.map((extension) => MIME_BY_EXTENSION[extension]).filter(Boolean),
  ].join(',');

  return (
    <>
      {!readOnly && (
        <>
          <div
            role="button"
            tabIndex={0}
            className={`${styles.dropZone} ${draggingOver ? styles.dropZoneOver : ''} ${invalid ? styles.invalid : ''}`}
            aria-labelledby={labelId}
            aria-describedby={[describedBy, rejectedMessages.length ? rejectedId : ''].filter(Boolean).join(' ') || undefined}
            aria-invalid={invalid || undefined}
            onClick={() => inputRef.current?.click()}
            onKeyDown={onDropZoneKeyDown}
            onDragEnter={onDragOver}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
              <path d="M12 17v-6" />
              <path d="m9 13 3-3 3 3" />
            </svg>
            <strong>Kéo thả tệp vào đây hoặc bấm để chọn</strong>
            <span>
              {acceptedExtensionsText(question)} — tối đa {question.maxMB} MB/tệp
            </span>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept={acceptAttribute}
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </>
      )}

      {files.length ? (
        <ul className={styles.fileList} aria-label="Các tệp đã chọn">
          {files.map((file) => (
            <li key={file.id}>
              <span className={styles.fileType}>{fileExtensionLabel(file.name)}</span>
              <span className={styles.fileName} title={file.name}>
                {file.name}
              </span>
              <span className={styles.fileSize}>{formatFileSize(file.sizeBytes)}</span>
              {!readOnly && (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Gỡ tệp ${file.name}`}
                  title="Gỡ tệp"
                  onClick={() => removeFile(file.id)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyValue}>Chưa có tệp nào.</p>
      )}

      {!readOnly && rejectedMessages.length > 0 && (
        <p id={rejectedId} className={styles.error} role="alert">
          {rejectedMessages.map((message) => (
            <span key={message} className={styles.errorLine}>
              {message}
            </span>
          ))}
        </p>
      )}
    </>
  );
}
