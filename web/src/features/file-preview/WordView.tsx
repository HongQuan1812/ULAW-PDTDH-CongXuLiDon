/* Xem Word (.docx): dựng trang bằng docx-preview (tải khi cần). File .doc cũ không xem được.
   Bản xem là gần đúng: font thay thế nếu máy không có, ngắt trang chỉ theo ngắt trang đặt sẵn trong file. */
import { useEffect, useRef, useState } from 'react';
import { PreviewMessage } from './PreviewMessage';
import styles from './FilePreview.module.css';

/**
 * @param blob  nội dung tệp .docx
 * @returns     các trang Word; đang mở thì có chữ chờ; hỏng thì có câu báo
 */
export function WordView({ blob }: { blob: Blob }) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const pagesBox = pagesRef.current;

    /** Dựng các trang vào khung; hỏng thì báo lỗi. */
    async function render() {
      try {
        const { renderAsync } = await import('docx-preview');
        if (cancelled || !pagesBox) return;
        await renderAsync(await blob.arrayBuffer(), pagesBox, undefined, {
          inWrapper: true,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          useBase64URL: true,
        });
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    void render();

    return () => {
      cancelled = true;
      pagesBox?.replaceChildren();
    };
  }, [blob]);

  return (
    <>
      {status === 'loading' && <PreviewMessage>Đang mở file Word…</PreviewMessage>}
      {status === 'error' && (
        <PreviewMessage title="Không xem trước được file này">Tải file về máy để mở bằng Word.</PreviewMessage>
      )}
      <div ref={pagesRef} className={styles.word} hidden={status !== 'ready'} />
    </>
  );
}
