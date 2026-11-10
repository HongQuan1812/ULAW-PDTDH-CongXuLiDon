/* Câu báo lỗi khi tải dữ liệu. Muốn tải lại thì bấm nút ↻ (RefreshButton) cạnh tiêu đề khung. */
import type { UseQueryResult } from '@tanstack/react-query';
import styles from './LoadError.module.css';

/** Câu báo khi lỗi không kèm câu nào (vd mất mạng giữa chừng). */
const DEFAULT_LOAD_ERROR_TEXT = 'Không tải được dữ liệu.';

/**
 * Câu báo lỗi của một lần tải dữ liệu, chỉ khi khung chưa có dữ liệu nào để hiện.
 * Đã có dữ liệu (tải lại bị lỗi) thì khung giữ dữ liệu cũ, lỗi báo bằng toast (xem RefreshButton).
 * @param query  kết quả useQuery của khung
 * @returns      câu báo lỗi; không lỗi, hoặc vẫn còn dữ liệu cũ, thì null
 */
export function loadErrorMessage(query: UseQueryResult<unknown>): string | null {
  if (!query.isError || query.data !== undefined) return null;
  return query.error.message || DEFAULT_LOAD_ERROR_TEXT;
}

/**
 * Câu báo lỗi tải dữ liệu.
 * @param message  câu báo
 * @param compact  true: chữ nhỏ trên một dòng (đặt cạnh một ô thông tin); mặc định: khối căn giữa
 * @returns        câu báo, được đọc ngay cho trình đọc màn hình
 */
export function LoadError({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <p className={compact ? styles.compact : styles.block} role="alert">
      {message}
    </p>
  );
}
