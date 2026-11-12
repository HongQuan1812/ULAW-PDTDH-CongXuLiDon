/* Thông báo ngắn hiện ở giữa phía trên màn hình rồi tự tắt.
   3 kiểu, mỗi kiểu một màu và một biểu tượng: thành công (xanh ngọc, ✓), lỗi (đỏ hồng, ×, hiện lâu hơn),
   thông tin (xanh lơ, i, mặc định).
   Rê chuột vào (hoặc đưa con trỏ bàn phím vào nút ×) thì giữ thông báo; rời ra thì đếm lại từ đầu. Nút × góc phải trên để tắt ngay.
   Lỗi của từng ô nhập / câu hỏi hiện ngay dưới ô đó; toast chỉ báo chung. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

/** Kiểu thông báo: 'success' thành công · 'error' lỗi · 'info' thông tin. */
export type ToastTone = 'success' | 'error' | 'info';

/** Thời gian thông báo hiện trước khi tự tắt (mili giây); lỗi hiện lâu hơn để kịp đọc. */
const TOAST_DURATION_MS: Record<ToastTone, number> = { success: 2000, info: 2000, error: 3500 };

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

  /**
   * Hẹn giờ tắt thông báo (hủy hẹn giờ cũ nếu có).
   * @param tone  kiểu thông báo, quyết định thời gian hiện
   */
  const startTimer = useCallback((tone: ToastTone) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShown(null), TOAST_DURATION_MS[tone]);
  }, []);

  /** Giữ thông báo: hủy hẹn giờ tắt. */
  const holdToast = () => window.clearTimeout(timerRef.current);

  /** Tắt thông báo ngay. */
  const dismissToast = () => {
    window.clearTimeout(timerRef.current);
    setShown(null);
  };

  // Hiện thông báo mới (thay thông báo cũ nếu đang hiện) và hẹn giờ tắt theo kiểu
  const show = useCallback<ShowToast>(
    (message, tone = 'info') => {
      setShown({ id: nextIdRef.current++, message, tone });
      startTimer(tone);
    },
    [startTimer],
  );

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
          onMouseEnter={holdToast}
          onMouseLeave={() => startTimer(shown.tone)}
          onFocus={holdToast}
          onBlur={() => startTimer(shown.tone)}
        >
          <ToneIcon tone={shown.tone} />
          <span className={styles.message}>{shown.message}</span>
          <button type="button" className={styles.close} aria-label="Tắt thông báo" title="Tắt" onClick={dismissToast}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      )}
    </ToastContext>
  );
}

/** Nét vẽ màu trắng bên trong hình tròn của biểu tượng, theo kiểu thông báo. */
const TONE_GLYPH: Record<ToastTone, string> = {
  success: 'm8 12.3 2.7 2.7L16 9.6', // dấu ✓
  error: 'M9 9l6 6M15 9l-6 6', // dấu ×
  info: 'M12 11v5.5M12 7.6v.01', // chữ i
};

/**
 * Biểu tượng đầu thông báo: hình tròn đặc cùng màu chữ, dấu trắng bên trong; để phân biệt cả khi không nhìn rõ màu.
 * @param tone  'success' dấu ✓ · 'error' dấu × · 'info' chữ i
 * @returns     biểu tượng svg
 */
function ToneIcon({ tone }: { tone: ToastTone }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d={TONE_GLYPH[tone]} fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Lấy hàm hiện thông báo.
 * @returns  hàm nhận câu thông báo và kiểu, vd toast('Đã lưu thông tin cá nhân', 'success');
 *           không truyền kiểu thì là thông tin (xanh lơ)
 */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast phải dùng bên trong <ToastProvider>.');
  return show;
}
