/* Cho các thao tác xử lí đơn (Duyệt, Yêu cầu bổ sung, Từ chối) chờ 10 giây rồi mới gửi lên máy chủ.
   Trong lúc chờ hiện một thanh nhỏ ở góc trái dưới với nút Hoàn tác. Đặt một lần ở gốc để việc đang chờ vẫn chạy khi người dùng sang trang khác;
   đóng hẳn trang trong lúc chờ thì trình duyệt hỏi lại, vì việc chưa được gửi. */
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { UNDO_WINDOW_MS, createUndoScheduler, type PendingTask, type UndoScheduler, type UndoableTask } from '../../lib/undoScheduler';
import { useToast } from '../../components/Toast';
import styles from './UndoProvider.module.css';

/** Câu báo khi đơn đang chờ một thao tác khác. */
const BUSY_TEXT = 'Đơn này đang chờ một thao tác khác. Hoàn tác hoặc đợi thao tác đó xong rồi làm tiếp.';

/** Câu báo sau khi hoàn tác. */
const UNDONE_TEXT = 'Đã hoàn tác, chưa có gì được gửi đi.';

interface UndoContextValue {
  /** Hẹn giờ một việc; đơn đang chờ việc khác thì báo và không nhận. */
  run: (task: UndoableTask) => void;
  /** Khóa (mã đơn) đang có việc chờ không. */
  isPending: (key: string) => boolean;
}

const UndoContext = createContext<UndoContextValue | null>(null);

/**
 * Cung cấp hàm hẹn giờ cho cả ứng dụng và vẽ thanh đếm ngược các việc đang chờ.
 * @param children  toàn bộ ứng dụng (nằm trong ToastProvider)
 * @returns         ứng dụng + thanh đếm ngược khi có việc chờ
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const scheduler = useMemo<UndoScheduler>(() => createUndoScheduler(), []);
  const pending = useSyncExternalStore(scheduler.subscribe, scheduler.getPending);
  // Đang có việc chờ mà đóng trang thì hỏi lại, vì việc chưa gửi
  useEffect(() => {
    if (pending.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending.length]);

  const value = useMemo<UndoContextValue>(
    () => ({
      run: (task) => {
        if (scheduler.schedule(task) === null) toast(BUSY_TEXT, 'error');
      },
      isPending: scheduler.isPending,
    }),
    // pending có trong danh sách phụ thuộc để mọi nơi dùng isPending vẽ lại khi việc chờ thay đổi
    [scheduler, toast, pending],
  );

  return (
    <UndoContext value={value}>
      {children}
      {pending.length > 0 && (
        <div className={styles.stack}>
          {pending.map((task) => (
            <PendingRow
              key={task.id}
              task={task}
              onSendNow={() => scheduler.performNow(task.id)}
              onUndo={() => {
                scheduler.undo(task.id);
                toast(UNDONE_TEXT, 'info');
              }}
            />
          ))}
        </div>
      )}
    </UndoContext>
  );
}

/**
 * Một hộp đếm ngược: mô tả việc, số giây còn lại, nút Hoàn tác, nút Ngay và luôn. Nền hộp đổi dần theo thời gian còn lại.
 * @param task       việc đang chờ
 * @param onUndo     bấm Hoàn tác
 * @param onSendNow  bấm Ngay và luôn: làm liền, không chờ hết giờ
 * @returns       dòng thông báo (đọc cho trình đọc màn hình như một vùng trạng thái)
 */
function PendingRow({ task, onUndo, onSendNow }: { task: PendingTask; onUndo: () => void; onSendNow: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(ticker);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((task.endsAt - now) / 1000));
  // Nền chạy hết UNDO_WINDOW_MS; hộp dựng giữa chừng (vd vẽ lại) thì bắt đầu từ chỗ đã trôi qua
  const [elapsedMs] = useState(() => Date.now() - (task.endsAt - UNDO_WINDOW_MS));

  return (
    <div className={styles.row} role="status" style={{ '--undo-window': `${UNDO_WINDOW_MS}ms`, '--undo-elapsed': `-${elapsedMs}ms` } as CSSProperties}>
      <p className={styles.title}>{task.message}</p>
      <p className={styles.text}>
        Sẽ có hiệu lực sau <b>{secondsLeft}</b> giây. Bấm Hoàn tác nếu bấm nhầm.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.sendNow} title="Làm ngay, không chờ hết giờ" onClick={onSendNow}>
          Ngay và luôn
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 14 0M13 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" className={styles.undo} onClick={onUndo}>
          Hoàn tác
        </button>
      </div>
    </div>
  );
}

/**
 * Lấy hàm hẹn giờ.
 * @returns  run(task) hẹn giờ · isPending(key) hỏi đơn đang chờ không
 */
export function useUndoable(): UndoContextValue {
  const context = useContext(UndoContext);
  if (!context) throw new Error('useUndoable phải dùng bên trong UndoProvider');
  return context;
}
