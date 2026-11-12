/* Phần xem nhanh của một dòng trong bảng đơn:
   chỉ các phần được bật "Nội dung chính" trong trình soạn, dùng đúng khung của trang chi tiết đơn ở chế độ chỉ xem,
   kèm dòng "Cập nhật lúc …" và "Phòng Đào tạo: <lí do>" (nếu có). Chỉ tải nội dung đơn khi dòng được mở. */
import { useFormDetail } from '../../api/form';
import { FormSections } from '../../features/form-renderer/FormSections';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { formatDateTime } from '../../lib/format';
import styles from './QuickView.module.css';

/**
 * Nội dung xem nhanh của một đơn.
 * @param code  mã đơn đang mở xem nhanh
 * @returns     đang tải / câu báo lỗi kèm nút ↻ / nội dung chính của đơn
 */
export function QuickView({ code }: { code: string }) {
  const detailQuery = useFormDetail(code);
  const form = detailQuery.data;
  const errorMessage = loadErrorMessage(detailQuery);

  if (errorMessage) {
    return (
      <div className={styles.quick}>
        <LoadError message={errorMessage} compact />
        <RefreshButton query={detailQuery} label={`đơn ${code}`} />
      </div>
    );
  }
  if (!form) return <p className={styles.loading}>Đang tải nội dung đơn…</p>;

  return (
    <div className={styles.quick}>
      <FormSections sections={form.sections} answers={form.answers} readOnly onlyMain />
      <p className={styles.updated}>Cập nhật lúc {formatDateTime(form.updatedAt)}</p>
      {form.note && (
        <p className={styles.note}>
          <b>Phòng Đào tạo:</b> {form.note}
        </p>
      )}
    </div>
  );
}
