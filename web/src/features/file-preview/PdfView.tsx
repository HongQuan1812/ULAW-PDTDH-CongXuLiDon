/* Xem PDF: dựng từng trang bằng pdf.js (tải khi cần), tối đa MAX_PAGES trang đầu. */
import { useEffect, useRef, useState } from 'react';
import { PreviewMessage } from './PreviewMessage';

/** Số trang tối đa dựng ra. */
const MAX_PAGES = 30;
/** Bề ngang tối đa của một trang (px trên màn hình). */
const MAX_PAGE_WIDTH = 900;

/**
 * @param blob       nội dung PDF
 * @param onMeta     báo thông tin phụ cho thanh trên, vd "12 trang"
 * @returns          các trang PDF xếp dọc; đang mở thì có chữ chờ; hỏng thì có câu báo
 */
export function PdfView({ blob, onMeta }: { blob: Blob; onMeta: (metaText: string) => void }) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [shownNote, setShownNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    const pagesBox = pagesRef.current;

    /** Mở PDF rồi dựng lần lượt từng trang; dừng ngay khi đóng. */
    async function render() {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (cancelled || !pagesBox) return;
        setStatus('ready');
        onMeta(`${pdfDocument.numPages} trang`);

        const pageWidth = Math.min(pagesBox.clientWidth || MAX_PAGE_WIDTH, MAX_PAGE_WIDTH);
        const pixelRatio = window.devicePixelRatio || 1;
        const lastPage = Math.min(pdfDocument.numPages, MAX_PAGES);
        for (let pageNumber = 1; pageNumber <= lastPage; pageNumber++) {
          const page = await pdfDocument.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (pageWidth / baseViewport.width) * pixelRatio });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / pixelRatio}px`;
          canvas.setAttribute('aria-label', `Trang ${pageNumber}`);
          pagesBox.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;
        }
        if (pdfDocument.numPages > lastPage) setShownNote(`Đang hiển thị ${lastPage} trang đầu trong ${pdfDocument.numPages} trang.`);
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    void render();

    return () => {
      cancelled = true;
      pagesBox?.replaceChildren();
    };
  }, [blob, onMeta]);

  return (
    <>
      {status === 'loading' && <PreviewMessage>Đang mở tệp PDF…</PreviewMessage>}
      {status === 'error' && (
        <PreviewMessage title="Không mở được tệp PDF này">
          Tệp có thể bị hỏng hoặc có mật khẩu. Hãy kiểm tra lại tệp trên máy rồi tải lên lại.
        </PreviewMessage>
      )}
      <div ref={pagesRef} style={{ display: status === 'ready' ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }} />
      {shownNote && <PreviewMessage>{shownNote}</PreviewMessage>}
    </>
  );
}
