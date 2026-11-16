/* Một mục thu gọn được trong khung "Lịch và nơi lưu", kiểu các mục OUTLINE / TIMELINE của VS Code:
   hàng tiêu đề chữ hoa nhỏ có mũi tên ▸ / ▾ (bấm để thu gọn / mở), số mục, nút + ở bên phải. Trình duyệt nhớ mục nào đang thu gọn. */
import { useId, useState, type ReactNode } from 'react';
import styles from './BackupsPage.module.css';

/**
 * Đọc lựa chọn thu gọn đã nhớ; trình duyệt chặn localStorage thì coi như đang mở.
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
 * Nhớ lựa chọn thu gọn; trình duyệt chặn localStorage thì bỏ qua.
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
  /** Tên mục, vd "Lịch định kì" (hiện chữ hoa) */
  title: string;
  /** Số mục con, hiện cạnh tên */
  count: number;
  /** Chữ của nút + cho trình đọc màn hình và khi rê chuột, vd "Thêm lịch" */
  addLabel: string;
  onAdd: () => void;
  /** Khóa localStorage nhớ việc thu gọn */
  storageKey: string;
  children: ReactNode;
}

/**
 * Mục thu gọn được.
 * @param props  xem PanelSectionProps
 * @returns      khối mục: hàng tiêu đề, nội dung (ẩn khi thu gọn)
 */
export function PanelSection({ title, count, addLabel, onAdd, storageKey, children }: PanelSectionProps) {
  const bodyId = useId();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey));

  /** Bấm hàng tiêu đề: thu gọn / mở, nhớ lại. */
  const toggle = () => {
    setCollapsed(!collapsed);
    saveCollapsed(storageKey, !collapsed);
  };

  return (
    <section className={styles.panelSection}>
      <div className={styles.panelSectionHead}>
        <button type="button" className={styles.panelSectionToggle} aria-expanded={!collapsed} aria-controls={bodyId} onClick={toggle}>
          <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
          <h3>{title}</h3>
          <span className={styles.panelSectionCount}>{count}</span>
        </button>
        <button type="button" className={styles.panelSectionAdd} aria-label={addLabel} title={addLabel} onClick={onAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      <div id={bodyId} className={styles.panelSectionBody} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
