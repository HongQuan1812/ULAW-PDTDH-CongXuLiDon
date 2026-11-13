/* Ô Ghi chú của bảng đơn: số ghi chú của đơn; bấm thì mở trang chi tiết đơn và mở sẵn khung ghi chú. */
import type { MouseEvent } from 'react';
import { NoteIcon } from './NoteIcon';
import styles from './NoteCountButton.module.css';

interface NoteCountButtonProps {
  /** Mã đơn, cho tên nút */
  code: string;
  /** Số ghi chú; undefined = đang tải hoặc tải lỗi (chỉ hiện hình) */
  count: number | undefined;
  /** Mở trang chi tiết đơn kèm khung ghi chú */
  onOpen: () => void;
}

/**
 * Nút trong ô Ghi chú: có ghi chú thì hình xanh kèm số, chưa có thì hình mờ (vẫn bấm được để viết ghi chú đầu tiên).
 * Bấm nút không tính là bấm dòng (dòng mở trang đơn mà không mở khung ghi chú).
 * @param props  xem NoteCountButtonProps
 * @returns      thẻ <button>
 */
export function NoteCountButton({ code, count, onOpen }: NoteCountButtonProps) {
  const hasNotes = !!count;

  /** Bấm: mở khung ghi chú của đơn, không để dòng bắt lần bấm này. */
  const openNotes = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpen();
  };

  return (
    <button
      type="button"
      className={`${styles.button} ${hasNotes ? styles.hasNotes : ''}`}
      onClick={openNotes}
      // Enter trên nút chỉ bấm nút, không mở dòng
      onKeyDown={(event) => event.stopPropagation()}
      aria-label={hasNotes ? `Ghi chú của đơn ${code} (${count})` : `Ghi chú của đơn ${code}: chưa có`}
      title={hasNotes ? 'Xem ghi chú' : 'Viết ghi chú'}
    >
      <NoteIcon size={18} />
      {hasNotes && <span>{count}</span>}
    </button>
  );
}
