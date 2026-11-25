/* Nút "Hiện CCCD / Ẩn CCCD" trên thanh công cụ của bảng, nằm sau nút Lọc.
   Cùng kiểu với nút Sắp xếp, Lọc; đang hiện thì tô màu như nút đang bật.
   useCccdToggle gom việc bật / tắt, tải số CCCD và báo lỗi, các bảng có nút Hiện CCCD cùng dùng. */
import { useEffect, useState, type ReactElement } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useToast } from '../Toast';
import styles from './table.module.css';

/** Câu báo khi không tải được số CCCD mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const CCCD_FAILED_TEXT = 'Chưa tải được số CCCD. Kiểm tra kết nối mạng rồi bấm Hiện CCCD lại.';

/** CCCD đầy đủ theo id người dùng (null = người đó chưa khai CCCD). */
type CccdsById = Readonly<Record<string, string | null>>;

/**
 * Nút bật / tắt hiện số CCCD đầy đủ trong bảng.
 * @param shown     đang hiện CCCD đầy đủ
 * @param loading   đang tải số CCCD (chỉ khi vừa bấm Hiện): khóa nút, ghi "Đang tải…"
 * @param onToggle  bấm nút
 * @returns         nút bấm
 */
export function CccdToggleButton({ shown, loading, onToggle }: { shown: boolean; loading: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.toolButton} ${shown ? styles.toolButtonOn : ''}`}
      aria-pressed={shown}
      disabled={loading}
      onClick={onToggle}
    >
      {loading ? 'Đang tải…' : shown ? 'Ẩn CCCD' : 'Hiện CCCD'}
    </button>
  );
}

/**
 * Hiện CCCD của một bảng: chỉ tải CCCD của những người đang có trên trang bảng; tải lỗi thì báo và tự ẩn lại (bấm Hiện CCCD để thử lần nữa).
 * @param useCccds  hook tải CCCD theo id, vd useAccountCccds, useApplicantCccds (mỗi bảng luôn truyền cùng một hook)
 * @param userIds   id những người đang có trên trang bảng
 * @returns         revealedCccds: CCCD đầy đủ theo id khi đang hiện, còn lại null · toggleButton: nút Hiện / Ẩn CCCD đặt trên thanh công cụ
 */
export function useCccdToggle(
  useCccds: (enabled: boolean, userIds: readonly string[]) => UseQueryResult<CccdsById>,
  userIds: readonly string[],
): { revealedCccds: CccdsById | null; toggleButton: ReactElement } {
  const toast = useToast();
  const [showCccd, setShowCccd] = useState(false);
  const cccdsQuery = useCccds(showCccd, userIds);

  // Tải lỗi thì báo và tự ẩn lại
  const cccdsError = cccdsQuery.isError ? cccdsQuery.error : null;
  useEffect(() => {
    if (!cccdsError) return;
    toast(cccdsError.message || CCCD_FAILED_TEXT, 'error');
    setShowCccd(false);
  }, [cccdsError, toast]);

  return {
    revealedCccds: showCccd && cccdsQuery.data ? cccdsQuery.data : null,
    toggleButton: (
      <CccdToggleButton
        shown={showCccd}
        loading={showCccd && cccdsQuery.isFetching}
        onToggle={() => setShowCccd((isShown) => !isShown)}
      />
    ),
  };
}
