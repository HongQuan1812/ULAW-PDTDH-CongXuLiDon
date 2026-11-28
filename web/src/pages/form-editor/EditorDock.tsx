/* Cột nút tròn nổi ở cạnh phải màn hình của trình soạn loại đơn, trên xuống dưới: "Cấu hình thời gian" (đồng hồ),
   "Mẫu xuất đơn" (Word) và "Mẫu xuất danh sách đơn" (Excel).
   Bấm một nút thì mở khung nổi của nút đó (TimeSettingsPanel, ExportTemplatesPanel), bấm lại hoặc bấm nút đóng thì đóng; mỗi lúc chỉ mở một khung.
   Số ở góc nút mẫu là số mẫu đang có (kể cả mẫu chưa lưu); có thay đổi chưa lưu thì số đổi màu cam. Nút đồng hồ có thay đổi chưa lưu thì có chấm cam. */
import { useRef, type CSSProperties } from 'react';
import type { ExportTemplate, ExportTemplatePurpose } from '@ulaw/shared';
import { useExportTemplates } from '../../api/exports';
import { useFloatingButtonBottom } from '../../lib/useFloatingButtonBottom';
import { PANEL_TEXT, ExportTemplatesPanel, type ExportTemplatesPanelProps } from './ExportTemplatesPanel';
import { templateRows, type ExportTemplateChanges } from './exportTemplateChanges';
import { TIME_SETTINGS_TITLE, TimeSettingsPanel, type TimeSettingsPanelProps } from './TimeSettingsPanel';
import styles from './EditorDock.module.css';

/** Khung nổi của trình soạn: cấu hình thời gian, hoặc mẫu xuất file theo mục đích. */
export type EditorDockPanel = 'time' | ExportTemplatePurpose;

/** Khoảng cách từ hai nút tròn tới đáy màn hình (px): màn hình rộng, màn hình hẹp (như CSS). */
const DOCK_BOTTOM = { wide: 16, narrow: 16 };

/** Thứ tự các nút, trên xuống dưới. */
const PURPOSES: readonly ExportTemplatePurpose[] = ['form', 'list'];

/**
 * Biểu tượng của nút theo mục đích: tờ giấy có chữ (mẫu đơn), bảng tính (mẫu danh sách đơn).
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

/** Biểu tượng đồng hồ của nút Cấu hình thời gian. */
function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
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

interface EditorDockProps {
  /** Như ExportTemplatesPanelProps, trừ purpose (mỗi nút mẫu một mục đích) */
  templates: Omit<ExportTemplatesPanelProps, 'purpose'>;
  /** Như TimeSettingsPanelProps; unsaved: có thay đổi chưa lưu */
  timeSettings: TimeSettingsPanelProps & { unsaved: boolean };
  /** Khung đang mở; null = không mở khung nào */
  openPanel: EditorDockPanel | null;
  /** Gọi khi mở khung khác hoặc đóng khung */
  onOpenPanelChange: (panel: EditorDockPanel | null) => void;
}

/**
 * Ba nút tròn nổi và khung nổi đang mở.
 * @param props  xem EditorDockProps
 * @returns      các nút, và khung của nút đang mở
 */
export function EditorDock({ templates, timeSettings, openPanel, onOpenPanelChange }: EditorDockProps) {
  const { formTypeId, changes } = templates;
  const { unsaved: timeUnsaved, ...timePanelProps } = timeSettings;
  const isTimeOpen = openPanel === 'time';
  const savedTemplates = useExportTemplates(formTypeId ?? '', formTypeId !== null).data ?? [];
  // Có thanh dính đáy (Lưu…) chồng lên chỗ của hai nút thì nút và khung nâng lên đứng trên thanh
  const dockRef = useRef<HTMLDivElement>(null);
  const dockBottom = useFloatingButtonBottom(dockRef, DOCK_BOTTOM);
  const dockBottomStyle = dockBottom === null ? undefined : ({ '--dock-bottom': `${dockBottom}px` } as CSSProperties);

  return (
    <div className={styles.dockScope} style={dockBottomStyle}>
      <div className={styles.dock} ref={dockRef}>
        <button
          type="button"
          className={`${styles.fab} ${styles.fabTime} ${isTimeOpen ? styles.fabOpen : ''}`}
          aria-expanded={isTimeOpen}
          aria-label={`${isTimeOpen ? 'Đóng' : 'Mở'} ${TIME_SETTINGS_TITLE}${timeUnsaved ? ', có thay đổi chưa lưu' : ''}`}
          title={timeUnsaved ? `${TIME_SETTINGS_TITLE} · có thay đổi chưa lưu` : TIME_SETTINGS_TITLE}
          onClick={() => onOpenPanelChange(isTimeOpen ? null : 'time')}
        >
          <ClockIcon />
          {timeUnsaved && <span className={`${styles.fabBadge} ${styles.fabBadgeUnsaved} ${styles.fabDot}`} aria-hidden="true" />}
        </button>
        {PURPOSES.map((purpose) => {
          const title = PANEL_TEXT[purpose].title;
          const count = templateRows(savedTemplates, changes, purpose).length;
          const unsaved = hasChangesFor(changes, savedTemplates, purpose);
          const isOpen = openPanel === purpose;
          return (
            <button
              key={purpose}
              type="button"
              className={`${styles.fab} ${purpose === 'list' ? styles.fabFormList : ''} ${isOpen ? styles.fabOpen : ''}`}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Đóng' : 'Mở'} ${title}${count ? `, ${count} mẫu` : ''}${unsaved ? ', có thay đổi chưa lưu' : ''}`}
              title={unsaved ? `${title} · có thay đổi chưa lưu` : title}
              onClick={() => onOpenPanelChange(isOpen ? null : purpose)}
            >
              <PurposeIcon purpose={purpose} />
              {count > 0 && <span className={`${styles.fabBadge} ${unsaved ? styles.fabBadgeUnsaved : ''}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Khung của nút đang mở; đổi nút thì dựng lại khung mới */}
      {isTimeOpen && <TimeSettingsPanel {...timePanelProps} onClose={() => onOpenPanelChange(null)} />}
      {openPanel && openPanel !== 'time' && (
        <ExportTemplatesPanel key={openPanel} purpose={openPanel} {...templates} onClose={() => onOpenPanelChange(null)} />
      )}
    </div>
  );
}
