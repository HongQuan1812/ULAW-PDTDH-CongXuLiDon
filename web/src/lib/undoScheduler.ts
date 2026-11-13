/* Hẹn giờ làm một việc sau 10 giây, trong lúc chờ thì hoàn tác được (như "Hoàn tác gửi" của Gmail).
   Dùng cho các thao tác xử lí đơn, để tránh bấm nhầm: chỉ sau 10 giây việc mới thật sự gửi lên máy chủ. */

/** Thời gian chờ trước khi việc được làm thật (mili giây). */
export const UNDO_WINDOW_MS = 10_000;

/** Việc cần hẹn giờ. */
export interface UndoableTask {
  /** Việc nào cùng khóa thì chỉ chờ một cái một lúc (vd mã đơn). */
  key: string;
  /** Mô tả ngắn cho người dùng, vd "Duyệt đơn XMM-…". */
  message: string;
  /** Việc làm thật, chạy khi hết 10 giây mà chưa hoàn tác. */
  perform: () => void;
}

/** Việc đang chờ. */
export interface PendingTask {
  id: number;
  key: string;
  message: string;
  /** Lúc việc được làm thật (mili giây, theo Date.now()). */
  endsAt: number;
}

/**
 * Tạo một bộ hẹn giờ (độc lập với React; giao diện đọc qua subscribe + getPending).
 * @returns  schedule: hẹn giờ một việc (trả id, hoặc null nếu đơn đó đang chờ một việc khác) ·
 *           undo: hủy việc đang chờ · performNow: làm ngay, không chờ hết giờ · isPending: khóa đó đang chờ không ·
 *           getPending: danh sách việc đang chờ (cùng một mảng nếu chưa đổi) · subscribe: nghe thay đổi, trả hàm ngừng nghe
 */
export function createUndoScheduler() {
  let nextId = 1;
  let pending: PendingTask[] = [];
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  const performers = new Map<number, () => void>();
  const listeners = new Set<() => void>();

  /** Đổi danh sách chờ rồi báo cho người nghe. */
  const setPending = (next: PendingTask[]) => {
    pending = next;
    listeners.forEach((listener) => listener());
  };

  /** Bỏ một việc khỏi danh sách chờ. */
  const remove = (id: number) => {
    timers.delete(id);
    performers.delete(id);
    setPending(pending.filter((task) => task.id !== id));
  };

  /** Làm ngay một việc đang chờ (hết giờ, hoặc người dùng bấm Ngay và luôn). */
  const performNow = (id: number) => {
    const perform = performers.get(id);
    if (!perform) return;
    clearTimeout(timers.get(id));
    remove(id);
    perform();
  };

  return {
    performNow,
    schedule(task: UndoableTask): number | null {
      if (pending.some((waiting) => waiting.key === task.key)) return null;
      const id = nextId++;
      setPending([...pending, { id, key: task.key, message: task.message, endsAt: Date.now() + UNDO_WINDOW_MS }]);
      performers.set(id, task.perform);
      timers.set(id, setTimeout(() => performNow(id), UNDO_WINDOW_MS));
      return id;
    },
    undo(id: number) {
      clearTimeout(timers.get(id));
      if (timers.has(id)) remove(id);
    },
    isPending: (key: string) => pending.some((task) => task.key === key),
    getPending: () => pending,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Bộ hẹn giờ của bộ hẹn giờ (kiểu trả về của createUndoScheduler). */
export type UndoScheduler = ReturnType<typeof createUndoScheduler>;
