/* Nút biểu tượng tròn của trình soạn: đưa lên, đưa xuống, nhân bản, xem, tải về, đổi tên, xóa, bỏ. */
import styles from './FormTypeEditor.module.css';

/** Hình vẽ của từng biểu tượng (đường SVG trên khung 24×24). */
const ICON_PATHS = {
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  copy: 'M5 15V5a2 2 0 0 1 2-2h10',
  view: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  rename: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  delete: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  remove: 'M6 6l12 12M18 6 6 18',
} as const;

export type EditorIcon = keyof typeof ICON_PATHS;

interface EditorIconButtonProps {
  icon: EditorIcon;
  /** Tên nút cho trình đọc màn hình và chữ hiện khi rê chuột, vd "Đưa câu hỏi lên" */
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Nút tròn chỉ có biểu tượng. Nút xóa / bỏ có màu đỏ.
 * @param props  xem EditorIconButtonProps
 * @returns      thẻ <button>
 */
export function EditorIconButton({ icon, label, onClick, disabled = false }: EditorIconButtonProps) {
  const isDestructive = icon === 'delete' || icon === 'remove';
  return (
    <button
      type="button"
      className={`${styles.iconButton} ${isDestructive ? styles.deleteButton : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <svg width={icon === 'remove' ? 14 : 16} height={icon === 'remove' ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon === 'copy' && <rect x="9" y="9" width="11" height="11" rx="2" />}
        {icon === 'view' && <circle cx="12" cy="12" r="3" />}
        <path d={ICON_PATHS[icon]} />
      </svg>
    </button>
  );
}
