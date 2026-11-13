/* Hai nút tròn nổi ở cạnh phải màn hình của trình soạn loại đơn: "Mẫu xuất file đơn" (Word) và "Mẫu xuất file thống kê" (Excel).
   Bấm một nút thì mở khung nổi của mẫu đó (ExportTemplatesPanel), bấm lại hoặc bấm nút đóng thì đóng; mỗi lúc chỉ mở một khung.
   Số ở góc nút là số mẫu đang có (kể cả mẫu chưa lưu); có thay đổi chưa lưu thì số đổi màu cam. */
import { useState } from 'react';
import type { ExportTemplate, ExportTemplatePurpose } from '@ulaw/shared';
import { useExportTemplates } from '../../api/exports';
import { PANEL_TEXT, ExportTemplatesPanel, type ExportTemplatesPanelProps } from './ExportTemplatesPanel';
import { templateRows, type ExportTemplateChanges } from './exportTemplateChanges';
import styles from './ExportTemplatesPanel.module.css';

/** Thứ tự các nút, trên xuống dưới. */
const PURPOSES: readonly ExportTemplatePurpose[] = ['form', 'stats'];

/**
 * Biểu tượng của nút theo mục đích: tờ giấy có chữ (mẫu đơn), bảng tính (mẫu thống kê).
 * @param purpose  mục đích của mẫu
 * @returns        hình SVG
 */
function PurposeIcon({ purpose }: { purpose: ExportTemplatePurpose }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {purpose === 'form' ? (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </>
      )}
    </svg>
  );
}

/**
 * Có thay đổi chưa lưu về mẫu của một mục đích không (thêm, đổi tên, xóa).
 * @param changes         các thay đổi chưa lưu (mọi mục đích)
 * @param savedTemplates  mẫu ở máy chủ
 * @param purpose         mục đích cần xét
 * @returns               true nếu có
 */
function hasChangesFor(changes: ExportTemplateChanges, savedTemplates: readonly ExportTemplate[], purpose: ExportTemplatePurpose): boolean {
  const savedIds = new Set(savedTemplates.filter((template) => template.purpose === purpose).map((template) => template.id));
  return (
    changes.added.some((staged) => staged.purpose === purpose) ||
    changes.removed.some((templateId) => savedIds.has(templateId)) ||
    Object.keys(changes.renamed).some((templateId) => savedIds.has(templateId))
  );
}

/**
 * Hai nút tròn nổi và khung nổi đang mở.
 * @param props  như ExportTemplatesPanelProps, trừ purpose (mỗi nút một mục đích)
 * @returns      các nút, và khung của nút đang mở
 */
export function ExportTemplatesDock(props: Omit<ExportTemplatesPanelProps, 'purpose'>) {
  const { formTypeId, changes } = props;
  const [openPurpose, setOpenPurpose] = useState<ExportTemplatePurpose | null>(null);
  const savedTemplates = useExportTemplates(formTypeId ?? '', formTypeId !== null).data ?? [];

  return (
    <>
      <div className={styles.dock}>
        {PURPOSES.map((purpose) => {
          const title = PANEL_TEXT[purpose].title;
          const count = templateRows(savedTemplates, changes, purpose).length;
          const unsaved = hasChangesFor(changes, savedTemplates, purpose);
          const isOpen = openPurpose === purpose;
          return (
            <button
              key={purpose}
              type="button"
              className={`${styles.fab} ${purpose === 'stats' ? styles.fabStats : ''} ${isOpen ? styles.fabOpen : ''}`}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Đóng' : 'Mở'} ${title}${count ? `, ${count} mẫu` : ''}${unsaved ? ', có thay đổi chưa lưu' : ''}`}
              title={unsaved ? `${title} · có thay đổi chưa lưu` : title}
              onClick={() => setOpenPurpose(isOpen ? null : purpose)}
            >
              <PurposeIcon purpose={purpose} />
              {count > 0 && <span className={`${styles.fabBadge} ${unsaved ? styles.fabBadgeUnsaved : ''}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Khung của nút đang mở; đổi nút thì dựng lại khung mới */}
      {openPurpose && <ExportTemplatesPanel key={openPurpose} purpose={openPurpose} {...props} onClose={() => setOpenPurpose(null)} />}
    </>
  );
}
