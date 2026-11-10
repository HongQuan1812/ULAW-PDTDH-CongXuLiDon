/* Nút ↻ ở đầu mỗi khung: tải lại riêng dữ liệu của khung đó, không phải tải lại cả trang. */
import type { UseQueryResult } from '@tanstack/react-query';
import { useToast } from './Toast';
import styles from './RefreshButton.module.css';

/**
 * Nút tải lại. Đang tải thì biểu tượng xoay và nút bị khóa; dữ liệu cũ vẫn hiện trong lúc chờ.
 * Tải lại bị lỗi mà khung đang có dữ liệu thì giữ dữ liệu cũ và hiện toast đỏ;
 * khung chưa có dữ liệu thì câu báo lỗi đã nằm sẵn trong khung (LoadError), không hiện toast.
 * @param query  kết quả useQuery của khung
 * @param label  tên khung, cho trình đọc màn hình và chữ khi rê chuột, vd "Đơn đã nộp"
 * @returns      nút tròn có biểu tượng ↻
 */
export function RefreshButton({ query, label }: { query: UseQueryResult<unknown>; label: string }) {
  const toast = useToast();
  const refreshing = query.isFetching;

  // Tải lại; lỗi mà vẫn còn dữ liệu cũ thì báo bằng toast
  const refresh = async () => {
    const result = await query.refetch();
    if (result.isError && result.data !== undefined) toast(result.error.message, 'error');
  };

  return (
    <button
      type="button"
      className={styles.refresh}
      aria-label={`Tải lại ${label}`}
      title={refreshing ? 'Đang tải lại…' : `Tải lại ${label}`}
      disabled={refreshing}
      onClick={refresh}
    >
      <svg
        className={refreshing ? styles.spinning : undefined}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.9 1 6.7 2.7L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    </button>
  );
}
