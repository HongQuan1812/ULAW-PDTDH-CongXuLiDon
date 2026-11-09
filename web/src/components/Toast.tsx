/* Thông báo ngắn hiện ở giữa phía dưới màn hình rồi tự tắt (như toast() của artifact/js/utils.js). */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

/** Thời gian thông báo hiện trước khi tự tắt (mili giây). */
const TOAST_DURATION_MS = 2600;

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast | null>(null);

/**
 * Cung cấp hàm hiện thông báo cho cả ứng dụng. Đặt một lần ở gốc.
 * @param children  toàn bộ ứng dụng
 * @returns         ứng dụng + khung thông báo (khi đang hiện)
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  // Hiện thông báo mới (thay thông báo cũ nếu đang hiện) và hẹn giờ tắt
  const show = useCallback<ShowToast>((next) => {
    window.clearTimeout(timerRef.current);
    setMessage(next);
    timerRef.current = window.setTimeout(() => setMessage(null), TOAST_DURATION_MS);
  }, []);

  // Rời khỏi ứng dụng thì hủy hẹn giờ
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <ToastContext value={show}>
      {children}
      {message && (
        <div className={styles.toast} role="status">
          {message}
        </div>
      )}
    </ToastContext>
  );
}

/**
 * Lấy hàm hiện thông báo.
 * @returns  hàm nhận câu thông báo, vd toast('Đã lưu thông tin cá nhân')
 */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast phải dùng bên trong <ToastProvider>.');
  return show;
}
