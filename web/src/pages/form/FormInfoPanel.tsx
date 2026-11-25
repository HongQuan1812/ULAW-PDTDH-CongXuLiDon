/* Khung "Thông tin đơn" ở trang đơn.
   Dùng chung cho trang nộp đơn mới (người nộp đơn) và trang chi tiết đơn (thêm trạng thái, người tiếp nhận, người xử lí).
   Trình soạn loại đơn dùng lại khung này với tiêu đề khác (khung "Phiên bản").
     - màn hình rộng: nằm bên phải nội dung đơn; bấm › để ẩn, nút "Thông tin đơn" ở đầu trang để hiện lại
       (nhớ lựa chọn trong trình duyệt này)
     - màn hình hẹp (≤ 1100px): ẩn sẵn, bấm "Thông tin đơn" để trượt ra từ bên phải; bấm ra ngoài, × hoặc Esc để đóng */
import { useCallback, useId, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useMediaQuery } from '../../lib/useMediaQuery';
import styles from './FormInfoPanel.module.css';

/** Điều kiện màn hình hẹp: khung chuyển sang dạng trượt ra. */
const NARROW_SCREEN_QUERY = '(max-width: 1100px)';

/** Khóa localStorage mặc định, nhớ việc người dùng đã ẩn khung "Thông tin đơn" ở màn hình rộng. */
const WIDE_HIDDEN_STORAGE_KEY = 'formInfoPanel.hiddenOnWideScreen';

/** Tiêu đề mặc định của khung và nút hiện khung. */
const DEFAULT_PANEL_TITLE = 'Thông tin đơn';

/** Trạng thái ẩn / hiện của khung, dùng cho cả nút "Thông tin đơn" và khung. */
export interface FormInfoPanelState {
  /** true: màn hình hẹp (khung trượt ra) */
  isNarrow: boolean;
  /** Khung đang hiện hay không (rộng: nằm bên phải · hẹp: đang trượt ra) */
  isOpen: boolean;
  /** Hiện khung */
  openPanel: () => void;
  /** Ẩn khung */
  closePanel: () => void;
}

/**
 * Đọc lựa chọn "đã ẩn khung" đã nhớ; trình duyệt chặn localStorage thì coi như chưa ẩn.
 * @param storageKey  khóa localStorage của khung
 * @returns           true nếu lần trước người dùng đã ẩn khung ở màn hình rộng
 */
function readWideHidden(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

/**
 * Nhớ lựa chọn ẩn / hiện khung ở màn hình rộng; trình duyệt chặn localStorage thì bỏ qua.
 * @param storageKey  khóa localStorage của khung
 * @param hidden      true: đã ẩn khung
 */
function saveWideHidden(storageKey: string, hidden: boolean): void {
  try {
    localStorage.setItem(storageKey, hidden ? '1' : '0');
  } catch {
    // không lưu được thì lần sau khung hiện như mặc định
  }
}

/**
 * Quản lí ẩn / hiện khung "Thông tin đơn" (hoặc khung khác cùng kiểu) theo cỡ màn hình.
 * @param storageKey  khóa localStorage nhớ lựa chọn ẩn khung; mỗi loại khung một khóa
 * @returns           trạng thái và lệnh ẩn / hiện khung
 */
export function useFormInfoPanel(storageKey: string = WIDE_HIDDEN_STORAGE_KEY): FormInfoPanelState {
  const isNarrow = useMediaQuery(NARROW_SCREEN_QUERY);
  const [hiddenOnWideScreen, setHiddenOnWideScreen] = useState(() => readWideHidden(storageKey));
  const [openOnNarrowScreen, setOpenOnNarrowScreen] = useState(false);

  // Màn hình rộng: nhớ lựa chọn; màn hình hẹp: chỉ mở / đóng khung trượt
  const setPanelOpen = useCallback(
    (open: boolean) => {
      if (isNarrow) {
        setOpenOnNarrowScreen(open);
        return;
      }
      setHiddenOnWideScreen(!open);
      saveWideHidden(storageKey, !open);
    },
    [isNarrow, storageKey],
  );
  const openPanel = useCallback(() => setPanelOpen(true), [setPanelOpen]);
  const closePanel = useCallback(() => setPanelOpen(false), [setPanelOpen]);

  return {
    isNarrow,
    isOpen: isNarrow ? openOnNarrowScreen : !hiddenOnWideScreen,
    openPanel,
    closePanel,
  };
}

/**
 * Nút "Thông tin đơn" ở đầu trang: hiện khi khung đang ẩn (màn hình rộng) hoặc luôn hiện (màn hình hẹp).
 * @param panel  trạng thái khung (useFormInfoPanel)
 * @param label  chữ trên nút, mặc định "Thông tin đơn"
 * @returns      nút, hoặc không gì khi khung đang nằm bên phải
 */
export function FormInfoPanelToggle({ panel, label = DEFAULT_PANEL_TITLE }: { panel: FormInfoPanelState; label?: string }) {
  if (!panel.isNarrow && panel.isOpen) return null;
  return (
    <Button className={styles.toggle} aria-haspopup={panel.isNarrow ? 'dialog' : undefined} onClick={panel.openPanel}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M15 4v16" />
      </svg>
      {label}
    </Button>
  );
}

/**
 * Khung "Thông tin đơn": màn hình rộng là thẻ bên phải (có nút › để ẩn); màn hình hẹp là khung trượt (Sheet).
 * @param panel     trạng thái khung (useFormInfoPanel)
 * @param title     tiêu đề khung, mặc định "Thông tin đơn"
 * @param children  các mục thông tin (FormInfoSection)
 * @returns         khung, hoặc không gì khi đang ẩn ở màn hình rộng
 */
export function FormInfoPanel({ panel, title = DEFAULT_PANEL_TITLE, children }: { panel: FormInfoPanelState; title?: string; children: ReactNode }) {
  const titleId = useId();
  if (panel.isNarrow) {
    return (
      <Sheet open={panel.isOpen} onClose={panel.closePanel} title={title}>
        <div className={`${styles.sections} ${styles.sheetSections}`}>{children}</div>
      </Sheet>
    );
  }
  if (!panel.isOpen) return null;
  return (
    <aside className={styles.side} aria-labelledby={titleId}>
      <section className={styles.card}>
        <div className={styles.head}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={styles.hide} aria-label={`Ẩn khung ${title.toLowerCase()}`} title="Ẩn" onClick={panel.closePanel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className={styles.sections}>{children}</div>
      </section>
    </aside>
  );
}

/**
 * Đọc lựa chọn thu gọn mục đã nhớ; trình duyệt chặn localStorage thì coi như đang mở.
 * @param storageKey  khóa localStorage của mục
 * @returns           true khi lần trước người dùng đã thu gọn
 */
function readCollapsed(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

/**
 * Nhớ lựa chọn thu gọn mục; trình duyệt chặn localStorage thì bỏ qua.
 * @param storageKey  khóa localStorage của mục
 * @param collapsed   true: đang thu gọn
 */
function saveCollapsed(storageKey: string, collapsed: boolean): void {
  try {
    localStorage.setItem(storageKey, collapsed ? '1' : '0');
  } catch {
    // không lưu được thì lần sau mục mở như mặc định
  }
}

interface PanelSectionProps {
  /** Tên mục, vd "Người nộp đơn", "Lịch định kì" (hiện chữ hoa) */
  title: string;
  /** Số mục con, hiện cạnh tên (không có thì không hiện) */
  count?: number;
  /** Nút hoặc liên kết chữ bên phải hàng tiêu đề, vd "Xem hồ sơ ›", "Chuyển giao" */
  action?: ReactNode;
  /** Nút + bên phải hàng tiêu đề: chữ cho trình đọc màn hình và khi rê chuột (vd "Thêm lịch"), lệnh khi bấm */
  add?: { label: string; onClick: () => void };
  /** Khóa localStorage nhớ việc thu gọn */
  storageKey: string;
  /** true: lề nội dung hẹp hơn, cho danh sách có viền từng mục (vd lịch, nơi lưu) */
  tightBody?: boolean;
  /** true: mục không co, không cuộn riêng, luôn hiện đủ dòng (vd Người nộp đơn); khung không đủ cao thì các mục khác co lại */
  fixed?: boolean;
  /** true: co hết phần khung thiếu nhưng không thấp hơn hàng tiêu đề (vd Lịch sử, mục cuộn duy nhất khi các mục khác không co) */
  keepMinHeight?: boolean;
  children: ReactNode;
}

/**
 * Mục thu gọn được trong khung, kiểu các mục OUTLINE / TIMELINE của VS Code:
 * hàng tiêu đề nền xám, chữ hoa nhỏ, mũi tên ▸ / ▾ (bấm để thu gọn / mở), số mục, nút bên phải. Trình duyệt nhớ mục nào đang thu gọn.
 * @param props  xem PanelSectionProps
 * @returns      khối mục: hàng tiêu đề, nội dung (ẩn khi thu gọn)
 */
export function PanelSection({ title, count, action, add, storageKey, tightBody = false, fixed = false, keepMinHeight = false, children }: PanelSectionProps) {
  const bodyId = useId();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey));

  /** Bấm hàng tiêu đề: thu gọn / mở, nhớ lại. */
  const toggle = () => {
    setCollapsed(!collapsed);
    saveCollapsed(storageKey, !collapsed);
  };

  return (
    <section
      className={`${styles.panelSection} ${fixed ? styles.panelSectionFixed : ''} ${keepMinHeight ? styles.panelSectionMinHeight : ''}`}
      data-collapsed={collapsed}
    >
      <div className={styles.panelSectionHead}>
        <button type="button" className={styles.panelSectionToggle} aria-expanded={!collapsed} aria-controls={bodyId} onClick={toggle}>
          <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
          <h3>{title}</h3>
          {count !== undefined && <span className={styles.panelSectionCount}>{count}</span>}
        </button>
        {action && <span className={styles.panelSectionAction}>{action}</span>}
        {add && (
          <button type="button" className={styles.panelSectionAdd} aria-label={add.label} title={add.label} onClick={add.onClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
      <div id={bodyId} className={`${styles.panelSectionBody} ${tightBody ? styles.panelSectionBodyTight : ''}`} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}

/** Khóa localStorage nhớ việc thu gọn các mục của khung "Thông tin đơn"; trang nộp đơn mới và trang chi tiết đơn dùng chung. */
export const INFO_SECTION_STORAGE_KEY = {
  applicant: 'formInfoPanel.applicant.collapsed',
  receiver: 'formInfoPanel.receiver.collapsed',
  handler: 'formInfoPanel.handler.collapsed',
  history: 'formInfoPanel.history.collapsed',
} as const;

/** Các dòng [nhãn, giá trị] của một mục thông tin. */
type InfoRows = readonly (readonly [label: string, content: ReactNode])[];

/**
 * Các dòng nhãn – giá trị.
 * @param rows  các dòng [nhãn, giá trị]
 * @returns     danh sách <dl>
 */
function InfoRowList({ rows }: { rows: InfoRows }) {
  return (
    <dl className={styles.meta}>
      {rows.map(([label, content]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{content}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Mục tóm tắt ở đầu khung (trạng thái, loại đơn, ngày nộp): không có tiêu đề, luôn hiện.
 * @param rows  các dòng [nhãn, giá trị]
 * @returns     khối mục
 */
export function FormInfoSummary({ rows }: { rows: InfoRows }) {
  return (
    <div className={styles.section}>
      <InfoRowList rows={rows} />
    </div>
  );
}

/**
 * Một mục thông tin thu gọn được, vd "Người nộp đơn": tiêu đề, nút / liên kết bên phải (nếu có), các dòng nhãn – giá trị.
 * @param title       tiêu đề mục
 * @param action      nút hoặc liên kết bên phải tiêu đề, vd "Xem hồ sơ ›"
 * @param storageKey  khóa localStorage nhớ việc thu gọn
 * @param rows        các dòng [nhãn, giá trị]
 * @returns           khối mục
 */
export function FormInfoSection({ title, action, storageKey, rows }: { title: string; action?: ReactNode; storageKey: string; rows: InfoRows }) {
  return (
    <PanelSection title={title} action={action} storageKey={storageKey} fixed>
      <InfoRowList rows={rows} />
    </PanelSection>
  );
}
