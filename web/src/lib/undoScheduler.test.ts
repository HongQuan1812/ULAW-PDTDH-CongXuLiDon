import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { UNDO_WINDOW_MS, createUndoScheduler } from './undoScheduler';

describe('bộ hẹn giờ cho phép hoàn tác', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('chưa làm ngay; đủ 10 giây mới làm', () => {
    // Arrange
    const scheduler = createUndoScheduler();
    const perform = vi.fn();

    // Act
    scheduler.schedule({ key: 'don-1', message: 'Duyệt đơn 1', perform });
    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    const performedBeforeEnd = perform.mock.calls.length;
    vi.advanceTimersByTime(1);

    // Assert
    expect(UNDO_WINDOW_MS).toBe(10_000);
    expect(performedBeforeEnd).toBe(0);
    expect(perform).toHaveBeenCalledTimes(1);
    expect(scheduler.isPending('don-1')).toBe(false);
  });

  test('hoàn tác trong 10 giây thì không làm gì cả', () => {
    const scheduler = createUndoScheduler();
    const perform = vi.fn();
    const id = scheduler.schedule({ key: 'don-1', message: 'Từ chối đơn 1', perform })!;

    vi.advanceTimersByTime(4000);
    scheduler.undo(id);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);

    expect(perform).not.toHaveBeenCalled();
    expect(scheduler.isPending('don-1')).toBe(false);
  });

  test('cùng một đơn đang chờ thì không nhận thêm việc khác', () => {
    const scheduler = createUndoScheduler();
    const first = vi.fn();
    const second = vi.fn();

    const firstId = scheduler.schedule({ key: 'don-1', message: 'Duyệt đơn 1', perform: first });
    const secondId = scheduler.schedule({ key: 'don-1', message: 'Từ chối đơn 1', perform: second });
    vi.advanceTimersByTime(UNDO_WINDOW_MS);

    expect(firstId).not.toBeNull();
    expect(secondId).toBeNull();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  test('đơn khác nhau chờ độc lập; danh sách chờ báo cho người nghe', () => {
    const scheduler = createUndoScheduler();
    const listener = vi.fn();
    scheduler.subscribe(listener);

    scheduler.schedule({ key: 'don-1', message: 'Duyệt đơn 1', perform: vi.fn() });
    scheduler.schedule({ key: 'don-2', message: 'Duyệt đơn 2', perform: vi.fn() });
    const waiting = scheduler.getPending().map((action) => action.key);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);

    expect(waiting).toEqual(['don-1', 'don-2']);
    expect(listener).toHaveBeenCalled();
    expect(scheduler.getPending()).toEqual([]);
  });

  test('getPending trả cùng một mảng nếu chưa có gì đổi', () => {
    const scheduler = createUndoScheduler();
    scheduler.schedule({ key: 'don-1', message: 'Duyệt đơn 1', perform: vi.fn() });

    expect(scheduler.getPending()).toBe(scheduler.getPending());
  });

  test('gửi ngay thì làm liền, không chờ đủ 10 giây và không làm lần hai', () => {
    const scheduler = createUndoScheduler();
    const perform = vi.fn();
    const id = scheduler.schedule({ key: 'don-1', message: 'Duyệt đơn 1', perform })!;

    vi.advanceTimersByTime(3000);
    scheduler.performNow(id);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);

    expect(perform).toHaveBeenCalledTimes(1);
    expect(scheduler.isPending('don-1')).toBe(false);
  });
});
