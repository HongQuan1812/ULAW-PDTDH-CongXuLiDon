/* Khung "Thông tin đơn" ở trang đơn (như #fSide và cuối artifact/js/application-form.js).
   Dùng chung cho trang nộp đơn mới (người nộp đơn) và trang chi tiết đơn (thêm trạng thái, người tiếp nhận, người xử lí).
     - màn hình rộng: nằm bên phải nội dung đơn; bấm › để ẩn, nút "Thông tin đơn" ở đầu trang để hiện lại
       (nhớ lựa chọn trong trình duyệt này)
     - màn hình hẹp (≤ 1100px): ẩn sẵn, bấm "Thông tin đơn" để trượt ra từ bên phải; bấm ra ngoài, × hoặc Esc để đóng */
import { useCallback, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useMediaQuery } from '../../lib/useMediaQuery';
import styles from './FormInfoPanel.module.css';

/** Điều kiện màn hình hẹp: khung chuyển sang dạng trượt ra. */
const NARROW_SCREEN_QUERY = '(max-width: 1100px)';

/** Khóa localStorage nhớ việc người dùng đã ẩn khung ở màn hình rộng. */
const WIDE_HIDDEN_STORAGE_KEY = 'formInfoPanel.hiddenOnWideScreen';

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
 * @returns  true nếu lần trước người dùng đã ẩn khung ở màn hình rộng
 */
function readWideHidden(): boolean {
  try {
    return localStorage.getItem(WIDE_HIDDEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Nhớ lựa chọn ẩn / hiện khung ở màn hình rộng; trình duyệt chặn localStorage thì bỏ qua.
 * @param hidden  true: đã ẩn khung
 */
function saveWideHidden(hidden: boolean): void {
  try {
    localStorage.setItem(WIDE_HIDDEN_STORAGE_KEY, hidden ? '1' : '0');
  } catch {
    // không lưu được thì lần sau khung hiện như mặc định
  }
}

/**
 * Quản lí ẩn / hiện khung "Thông tin đơn" theo cỡ màn hình.
 * @returns  trạng thái và lệnh ẩn / hiện khung
 */
export function useFormInfoPanel(): FormInfoPanelState {
  const isNarrow = useMediaQuery(NARROW_SCREEN_QUERY);
  const [hiddenOnWideScreen, setHiddenOnWideScreen] = useState(readWideHidden);
  const [openOnNarrowScreen, setOpenOnNarrowScreen] = useState(false);

  // Màn hình rộng: nhớ lựa chọn; màn hình hẹp: chỉ mở / đóng khung trượt
  const setPanelOpen = useCallback(
    (open: boolean) => {
      if (isNarrow) {
        setOpenOnNarrowScreen(open);
        return;
      }
      setHiddenOnWideScreen(!open);
      saveWideHidden(!open);
    },
    [isNarrow],
  );
  const openPanel = useCallback(() => setPanelOpen(true), [setPanelOpen]);
  const closePanel = useCallback(() => setPanelOpen(false), [setPanelOpen]);

  return { isNarrow, isOpen: isNarrow ? openOnNarrowScreen : !hiddenOnWideScreen, openPanel, closePanel };
}

/**
 * Nút "Thông tin đơn" ở đầu trang: hiện khi khung đang ẩn (màn hình rộng) hoặc luôn hiện (màn hình hẹp).
 * @param panel  trạng thái khung (useFormInfoPanel)
 * @returns      nút, hoặc không gì khi khung đang nằm bên phải
 */
export function FormInfoPanelToggle({ panel }: { panel: FormInfoPanelState }) {
  if (!panel.isNarrow && panel.isOpen) return null;
  return (
    <Button className={styles.toggle} aria-haspopup={panel.isNarrow ? 'dialog' : undefined} onClick={panel.openPanel}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M15 4v16" />
      </svg>
      Thông tin đơn
    </Button>
  );
}

/**
 * Khung "Thông tin đơn": màn hình rộng là thẻ bên phải (có nút › để ẩn); màn hình hẹp là khung trượt (Sheet).
 * @param panel     trạng thái khung (useFormInfoPanel)
 * @param children  các mục thông tin (FormInfoSection)
 * @returns         khung, hoặc không gì khi đang ẩn ở màn hình rộng
 */
export function FormInfoPanel({ panel, children }: { panel: FormInfoPanelState; children: ReactNode }) {
  if (panel.isNarrow) {
    return (
      <Sheet open={panel.isOpen} onClose={panel.closePanel} title="Thông tin đơn">
        <div className={styles.sections}>{children}</div>
      </Sheet>
    );
  }
  if (!panel.isOpen) return null;
  return (
    <aside className={styles.side} aria-labelledby="form-info-title">
      <section className={styles.card}>
        <div className={styles.head}>
          <h2 id="form-info-title">Thông tin đơn</h2>
          <button type="button" className={styles.hide} aria-label="Ẩn khung thông tin đơn" title="Ẩn" onClick={panel.closePanel}>
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
 * Một mục trong khung, vd "Người nộp đơn": tiêu đề nhỏ, nút / liên kết bên phải (nếu có), các dòng nhãn – giá trị.
 * @param title   tiêu đề mục; không có thì không có hàng tiêu đề (vd mục trạng thái, ngày nộp ở đầu khung)
 * @param shaded  true: nền khác màu để nổi bật (như #fMeta của bản mẫu, mục trạng thái ở đầu khung)
 * @param action  nút hoặc liên kết bên phải tiêu đề, vd "Xem hồ sơ ›"
 * @param rows    các dòng [nhãn, giá trị]
 * @returns       khối mục
 */
export function FormInfoSection({
  title,
  shaded = false,
  action,
  rows,
}: {
  title?: string;
  shaded?: boolean;
  action?: ReactNode;
  rows: readonly (readonly [label: string, content: ReactNode])[];
}) {
  return (
    <div className={`${styles.section} ${shaded ? styles.shaded : ''}`}>
      {title && (
        <div className={styles.sectionHead}>
          <h3>{title}</h3>
          {action}
        </div>
      )}
      <dl className={styles.meta}>
        {rows.map(([label, content]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{content}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
