/* Trình xem tệp toàn màn hình (như preview() của artifact/js/file-preview.js): ảnh, PDF, Word.
   Có sẵn nội dung (content) thì xem thẳng, vd file Word vừa xuất từ mẫu; tệp người nộp vừa chọn (id 'local-…') xem từ trình duyệt;
   còn lại là tệp đã lưu, tải nội dung từ máy chủ.
   Loại tệp chưa xem trước được (vd .doc cũ) thì có nút tải về. Esc, nút × hoặc bấm nền để đóng. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatFileSize, previewKindOf, type FileRef } from '@ulaw/shared';
import { useFileContent } from '../../api/files';
import { LoadError } from '../../components/LoadError';
import { LOCAL_FILE_ID_PREFIX, readLocalFile } from '../form-renderer/localFiles';
import { ImageView } from './ImageView';
import { PdfView } from './PdfView';
import { PreviewMessage } from './PreviewMessage';
import { WordView } from './WordView';
import styles from './FilePreview.module.css';

/** Tệp cần xem: FileRef của câu trả lời, có thể kèm nội dung sẵn và tên nút tải. */
export interface PreviewFile extends FileRef {
  /** Nội dung có sẵn trong trình duyệt (vd file Word vừa xuất); có thì xem thẳng, không gọi máy chủ */
  content?: Blob;
  /** Chữ trên nút tải về; mặc định "Tải về", vd "Tải file Word" */
  downloadLabel?: string;
  /** Tiêu đề trên thanh xem; mặc định là tên tệp (tên tệp vẫn dùng khi tải về), vd "XMM-2026-001-00001 · Đơn gửi phòng Đào tạo" */
  title?: string;
  /** Ghi chú thêm sau dung lượng, vd "Xem trước gần đúng · dữ liệu đơn XMM-…" */
  note?: string;
}

/**
 * Trình xem tệp; không có tệp thì không vẽ gì.
 * @param file     tệp đang xem; null = đang đóng
 * @param onClose  gọi khi người dùng muốn đóng
 * @returns        lớp phủ toàn màn hình, hoặc không gì cả
 */
export function FilePreview({ file, onClose }: { file: PreviewFile | null; onClose: () => void }) {
  return file ? <OpenFilePreview key={file.id} file={file} onClose={onClose} /> : null;
}

/**
 * Trình xem đang mở một tệp: lấy nội dung, chọn cách xem theo đuôi tệp.
 * @param file     tệp đang xem
 * @param onClose  gọi khi người dùng muốn đóng
 * @returns        lớp phủ có thanh trên (tên, dung lượng, Tải về, ×) và phần xem tệp
 */
function OpenFilePreview({ file, onClose }: { file: PreviewFile; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [extraMeta, setExtraMeta] = useState('');
  const showExtraMeta = useCallback((metaText: string) => setExtraMeta(metaText), []);

  // Nội dung có sẵn, hoặc tệp vừa chọn lấy từ trình duyệt; tệp đã lưu tải từ máy chủ
  const isLocal = !file.content && file.id.startsWith(LOCAL_FILE_ID_PREFIX);
  const needsServer = !file.content && !isLocal;
  const contentQuery = useFileContent(file.id, needsServer);
  const content: Blob | undefined = file.content ?? (isLocal ? readLocalFile(file.id) : undefined) ?? contentQuery.data;

  // Đường dẫn tạm để tải về
  const downloadUrl = useMemo(() => (content ? URL.createObjectURL(content) : null), [content]);
  useEffect(() => () => (downloadUrl ? URL.revokeObjectURL(downloadUrl) : undefined), [downloadUrl]);

  // Mở: khóa cuộn trang, đưa con trỏ vào nút ×; đóng: trả lại. Esc để đóng
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [onClose]);

  const kind = previewKindOf(file.name);
  const metaText = [formatFileSize(file.sizeBytes), file.note, extraMeta].filter(Boolean).join(' · ');

  /** Phần xem tệp theo trạng thái: đang tải, lỗi, hoặc cách xem theo loại tệp. */
  const renderBody = () => {
    if (!content) {
      if (isLocal) {
        return (
          <PreviewMessage title="Không còn tệp này trong trình duyệt">
            Trang đã được tải lại. Hãy chọn lại tệp để xem.
          </PreviewMessage>
        );
      }
      return contentQuery.isError ? <LoadError message={contentQuery.error.message} /> : <PreviewMessage>Đang tải tệp…</PreviewMessage>;
    }
    if (kind === 'image') return <ImageView blob={content} fileName={file.name} />;
    if (kind === 'pdf') return <PdfView blob={content} onMeta={showExtraMeta} />;
    if (kind === 'word') return <WordView blob={content} />;
    return <PreviewMessage title="Chưa xem trước được loại tệp này">Tải tệp về máy để mở.</PreviewMessage>;
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="file-preview-name">
      <div className={styles.bar}>
        <span id="file-preview-name" className={styles.name}>
          {file.title ?? file.name}
        </span>
        <span className={styles.meta}>{metaText}</span>
        {downloadUrl && (
          <a className={styles.download} href={downloadUrl} download={file.name}>
            {file.downloadLabel ?? 'Tải về'}
          </a>
        )}
        <button ref={closeButtonRef} type="button" className={styles.close} aria-label="Đóng" title="Đóng (Esc)" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className={styles.body}>{renderBody()}</div>
    </div>
  );
}
