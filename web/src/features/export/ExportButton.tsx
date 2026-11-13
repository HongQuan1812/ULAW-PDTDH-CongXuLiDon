/* Nút "Xuất file" ở trang chi tiết đơn:
   hiện khi loại đơn có mẫu xuất file đơn (Word; mẫu thống kê không dùng ở đây). Một mẫu thì bấm là xuất; nhiều mẫu thì mở danh sách "Chọn mẫu".
   Máy chủ điền dữ liệu của đơn vào mẫu; file Word nhận về mở trong trình xem, có nút "Tải file Word" trên thanh xem. */
import { useState } from 'react';
import type { ExportTemplate, FormDetail } from '@ulaw/shared';
import { exportForm, useExportTemplates } from '../../api/exports';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { FilePreview, type PreviewFile } from '../file-preview/FilePreview';
import styles from './ExportButton.module.css';
import { useTemplateMenu } from './useTemplateMenu';

/** Ghi chú trên thanh xem: bản xem trong trình duyệt chỉ gần đúng với Word (font thay thế, ngắt trang). */
export const DOCX_PREVIEW_NOTE = 'Xem trước gần đúng';

/**
 * Nút Xuất file của một lá đơn.
 * @param form       lá đơn đang xem
 * @param className  lớp CSS thêm cho nút (vd cỡ nút ở đầu trang)
 * @returns          nút (và danh sách chọn mẫu, trình xem file đã điền); loại đơn chưa có mẫu thì không hiện gì
 */
export function ExportButton({ form, className }: { form: FormDetail; className?: string }) {
  const toast = useToast();
  const templatesQuery = useExportTemplates(form.formTypeId);
  const templates = (templatesQuery.data ?? []).filter((template) => template.purpose === 'form');
  const { menuOpen, setMenuOpen, wrapRef, buttonRef } = useTemplateMenu();
  const [exporting, setExporting] = useState(false);
  const [exportedFile, setExportedFile] = useState<PreviewFile | null>(null);

  if (!templates.length) return null;

  /**
   * Xuất file theo một mẫu: xong thì mở trình xem file đã điền; lỗi thì báo câu máy chủ gửi.
   * @param template  mẫu đã chọn
   */
  const exportWith = async (template: ExportTemplate) => {
    setMenuOpen(false);
    setExporting(true);
    try {
      const docx = await exportForm(form.code, { templateId: template.id });
      setExportedFile({
        id: `export-${form.code}-${template.id}-${Date.now()}`,
        name: docx.fileName,
        sizeBytes: docx.content.size,
        content: docx.content,
        title: `${form.code} · ${template.name}`,
        note: DOCX_PREVIEW_NOTE,
        downloadLabel: 'Tải file Word',
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setExporting(false);
    }
  };

  // Một mẫu: xuất luôn; nhiều mẫu: mở / đóng danh sách chọn mẫu
  const onButtonClick = () => (templates.length === 1 ? void exportWith(templates[0]!) : setMenuOpen((open) => !open));

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <Button
        ref={buttonRef}
        className={className}
        aria-haspopup={templates.length > 1 ? 'menu' : undefined}
        aria-expanded={templates.length > 1 ? menuOpen : undefined}
        disabled={exporting}
        onClick={onButtonClick}
      >
        {/* biểu tượng xuất file: tờ giấy có mũi tên đi ra (không phải mũi tên xuống của nút tải về) */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="m5 11-3 3 3 3" />
          <path d="M2 14h10" />
        </svg>
        {exporting ? 'Đang tạo file…' : 'Xuất file'}
      </Button>
      {menuOpen && (
        <div className={styles.menu} role="menu" aria-label="Chọn mẫu">
          <p className={styles.menuTitle}>Chọn mẫu</p>
          {templates.map((template) => (
            <button key={template.id} type="button" role="menuitem" className={styles.option} onClick={() => void exportWith(template)}>
              <b>{template.name}</b>
              <span>{template.fileName}</span>
            </button>
          ))}
        </div>
      )}
      <FilePreview file={exportedFile} onClose={() => setExportedFile(null)} />
    </div>
  );
}
