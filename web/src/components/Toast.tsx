/* Thông báo ngắn hiện ở giữa phía trên màn hình rồi tự tắt (như toast() của artifact/js/utils.js).
   3 kiểu: thành công (nền xanh lá), lỗi (nền đỏ, hiện lâu hơn), thông tin (nền tối, mặc định).
   Lỗi gắn với form (ô nhập sai, không lưu được) thì hiện ngay trên form, không dùng toast. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

/** Kiểu thông báo: 'success' thành công · 'error' lỗi · 'info' thông tin. */
export type ToastTone = 'success' | 'error' | 'info';

/** Thời gian thông báo hiện trước khi tự tắt (mili giây); lỗi hiện lâu hơn để kịp đọc. */
const TOAST_DURATION_MS: Record<ToastTone, number> = { success: 2600, info: 2600, error: 5000 };

type ShowToast = (message: string, tone?: ToastTone) => void;

/** Thông báo đang hiện; id đổi mỗi lần hiện để hiệu ứng xuất hiện chạy lại. */
interface ShownToast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<ShowToast | null>(null);

/**
 * Cung cấp hàm hiện thông báo cho cả ứng dụng. Đặt một lần ở gốc.
 * @param children  toàn bộ ứng dụng
 * @returns         ứng dụng + khung thông báo (khi đang hiện)
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<ShownToast | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const nextIdRef = useRef(1);

  // Hiện thông báo mới (thay thông báo cũ nếu đang hiện) và hẹn giờ tắt theo kiểu
  const show = useCallback<ShowToast>((message, tone = 'info') => {
    window.clearTimeout(timerRef.current);
    setShown({ id: nextIdRef.current++, message, tone });
    timerRef.current = window.setTimeout(() => setShown(null), TOAST_DURATION_MS[tone]);
  }, []);

  // Rời khỏi ứng dụng thì hủy hẹn giờ
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <ToastContext value={show}>
      {children}
      {shown && (
        <div
          key={shown.id}
          className={`${styles.toast} ${styles[shown.tone]}`}
          // Lỗi: trình đọc màn hình đọc ngay; thành công / thông tin: đọc khi rảnh
          role={shown.tone === 'error' ? 'alert' : 'status'}
        >
          {shown.tone !== 'info' && <ToneIcon tone={shown.tone} />}
          {shown.message}
        </div>
      )}
    </ToastContext>
  );
}

/**
 * Biểu tượng đầu thông báo, để phân biệt cả khi không nhìn rõ màu.
 * @param tone  'success' dấu ✓ · 'error' dấu !
 * @returns     biểu tượng svg
 */
function ToneIcon({ tone }: { tone: Exclude<ToastTone, 'info'> }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" strokeWidth="2" />
      {tone === 'success' ? <path d="m8 12.5 2.7 2.7L16 9.8" /> : <path d="M12 7.5v5.5M12 16.5v.01" />}
    </svg>
  );
}

/**
 * Lấy hàm hiện thông báo.
 * @returns  hàm nhận câu thông báo và kiểu, vd toast('Đã lưu thông tin cá nhân', 'success');
 *           không truyền kiểu thì là thông tin (nền tối)
 */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast phải dùng bên trong <ToastProvider>.');
  return show;
}
