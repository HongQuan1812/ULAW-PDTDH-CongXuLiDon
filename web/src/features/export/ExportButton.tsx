/* Nút "Xuất file" ở trang chi tiết đơn:
   hiện khi loại đơn có mẫu xuất file đơn (Word; mẫu thống kê không dùng ở đây). Bấm nút thì mở hộp "Chọn mẫu xuất file":
   mỗi mẫu một dòng, tự so mã trong mẫu với các câu hỏi của lá đơn này (bản chụp lúc nộp), mã nào đơn không có thì báo đỏ như khi kiểm tra
   ở trình soạn loại đơn; người dùng thấy hệ thống đang đối chiếu mã giữa đơn và mẫu rồi bấm "Xuất" ở mẫu muốn dùng.
   Máy chủ điền dữ liệu của đơn vào mẫu; file Word nhận về mở trong trình xem, có nút "Tải file Word" trên thanh xem. */
import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { questionExportTags, type ExportTemplate, type FormDetail } from '@ulaw/shared';
import { checkFormExport, exportForm, useExportTemplates } from '../../api/exports';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { FilePreview, type PreviewFile } from '../file-preview/FilePreview';
import { checkFailureOf, checkResultOf, type TemplateResult } from './checkResult';
import styles from './ExportButton.module.css';

/** Ghi chú trên thanh xem: bản xem trong trình duyệt chỉ gần đúng với Word (font thay thế, ngắt trang). */
export const DOCX_PREVIEW_NOTE = 'Xem trước gần đúng';

/**
 * Nút Xuất file của một lá đơn.
 * @param form       lá đơn đang xem
 * @param className  lớp CSS thêm cho nút (vd cỡ nút ở đầu trang)
 * @returns          nút (và hộp chọn mẫu, trình xem file đã điền); loại đơn chưa có mẫu thì không hiện gì
 */
export function ExportButton({ form, className }: { form: FormDetail; className?: string }) {
  const toast = useToast();
  const templatesQuery = useExportTemplates(form.formTypeId);
  const templates = (templatesQuery.data ?? []).filter((template) => template.purpose === 'form');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportedFile, setExportedFile] = useState<PreviewFile | null>(null);

  // Chỉ kiểm tra khi hộp đang mở; mã mẫu và mã đơn đổi (hiếm) thì kiểm tra lại
  const tableTags = questionExportTags(form.sections)
    .filter((question) => question.columns)
    .map((question) => question.tag);
  const checks = useQueries({
    queries: templates.map((template) => ({
      queryKey: ['export-check', form.code, template.id, template.uploadedAt],
      queryFn: async (): Promise<TemplateResult> => {
        try {
          return checkResultOf(await checkFormExport(form.code, { templateId: template.id }), tableTags, 'đơn');
        } catch (error) {
          return checkFailureOf(error);
        }
      },
      enabled: dialogOpen,
      staleTime: 0,
    })),
  });

  if (!templates.length) return null;

  /**
   * Xuất file theo một mẫu: xong thì đóng hộp, mở trình xem file đã điền; lỗi thì báo câu máy chủ gửi.
   * @param template  mẫu đã chọn
   */
  const exportWith = async (template: ExportTemplate) => {
    setExportingId(template.id);
    try {
      const docx = await exportForm(form.code, { templateId: template.id });
      setDialogOpen(false);
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
      setExportingId(null);
    }
  };

  return (
    <>
      <Button className={className} aria-haspopup="dialog" onClick={() => setDialogOpen(true)}>
        {/* biểu tượng xuất file: tờ giấy có mũi tên đi ra (không phải mũi tên xuống của nút tải về) */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="m5 11-3 3 3 3" />
          <path d="M2 14h10" />
        </svg>
        Xuất file
      </Button>

      <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} title="Chọn mẫu xuất file" showCloseButton className={styles.dialog}>
        <p className={styles.dialogHint}>
          Hệ thống đối chiếu mã trong mỗi mẫu với các câu hỏi của đơn <b>{form.code}</b>. Mã nào đơn không có sẽ để trống trong file.
        </p>
        <ul className={styles.templateList}>
          {templates.map((template, index) => {
            const result = checks[index]?.data;
            return (
              <li key={template.id} className={styles.templateRow}>
                <div className={styles.templateInfo}>
                  <b>{template.name}</b>
                  <span>{template.fileName}</span>
                  {/* kết quả đối chiếu: đỏ khi có mã không khớp, xanh khi khớp hết */}
                  <p className={`${styles.result} ${result ? (result.tone === 'bad' ? styles.bad : styles.good) : ''}`} role="status">
                    {result ? result.text : 'Đang đối chiếu mã…'}
                  </p>
                </div>
                <Button disabled={exportingId !== null} onClick={() => void exportWith(template)}>
                  {exportingId === template.id ? 'Đang tạo…' : 'Xuất'}
                </Button>
              </li>
            );
          })}
        </ul>
      </Modal>

      <FilePreview file={exportedFile} onClose={() => setExportedFile(null)} />
    </>
  );
}
