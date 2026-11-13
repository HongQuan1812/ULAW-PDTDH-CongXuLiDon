/* Nút "Xuất thống kê" ở đầu trình soạn loại đơn:
   theo các mẫu xuất file thống kê ĐÃ LƯU của loại đơn. Một mẫu thì bấm là xuất; nhiều mẫu thì mở danh sách "Chọn mẫu";
   chưa có mẫu thì nút mờ, rê chuột vào thấy cách thêm mẫu.
   Máy chủ điền mọi lá đơn của loại đơn vào mẫu; file Excel tải thẳng về máy (trình duyệt không xem trước được Excel). */
import { useState } from 'react';
import type { ExportTemplate } from '@ulaw/shared';
import { exportStats, useExportTemplates } from '../../api/exports';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { saveToDevice } from '../../lib/saveToDevice';
import styles from './ExportButton.module.css';
import { useTemplateMenu } from './useTemplateMenu';

/**
 * Nút Xuất thống kê của một loại đơn.
 * @param formTypeId  mã loại đơn (đã lưu)
 * @param className   lớp CSS thêm cho nút
 * @returns           nút, và danh sách chọn mẫu khi có nhiều mẫu
 */
export function StatsExportButton({ formTypeId, className }: { formTypeId: string; className?: string }) {
  const toast = useToast();
  const templatesQuery = useExportTemplates(formTypeId);
  const templates = (templatesQuery.data ?? []).filter((template) => template.purpose === 'stats');
  const { menuOpen, setMenuOpen, wrapRef, buttonRef } = useTemplateMenu();
  const [exporting, setExporting] = useState(false);

  /**
   * Xuất theo một mẫu thống kê: xong thì tải file Excel về máy; lỗi thì báo câu máy chủ gửi.
   * @param template  mẫu đã chọn
   */
  const exportWith = async (template: ExportTemplate) => {
    setMenuOpen(false);
    setExporting(true);
    try {
      const exported = await exportStats(formTypeId, template.id);
      saveToDevice(exported.content, exported.fileName);
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setExporting(false);
    }
  };

  // Một mẫu: xuất luôn; nhiều mẫu: mở / đóng danh sách chọn mẫu
  const onButtonClick = () => (templates.length === 1 ? void exportWith(templates[0]!) : setMenuOpen((open) => !open));
  const hasMenu = templates.length > 1;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <Button
        ref={buttonRef}
        className={className}
        aria-haspopup={hasMenu ? 'menu' : undefined}
        aria-expanded={hasMenu ? menuOpen : undefined}
        disabled={exporting || !templates.length}
        title={
          templates.length
            ? 'Tải về file Excel có mọi đơn của loại đơn này'
            : 'Chưa có mẫu thống kê. Bấm nút tròn “Mẫu xuất file thống kê” ở cạnh phải, thêm file Excel rồi bấm Lưu.'
        }
        onClick={onButtonClick}
      >
        {/* biểu tượng bảng tính */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </svg>
        {exporting ? 'Đang xuất…' : 'Xuất thống kê'}
      </Button>
      {menuOpen && (
        <div className={styles.menu} role="menu" aria-label="Chọn mẫu thống kê">
          <p className={styles.menuTitle}>Chọn mẫu</p>
          {templates.map((template) => (
            <button key={template.id} type="button" role="menuitem" className={styles.option} onClick={() => void exportWith(template)}>
              <b>{template.name}</b>
              <span>{template.fileName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
