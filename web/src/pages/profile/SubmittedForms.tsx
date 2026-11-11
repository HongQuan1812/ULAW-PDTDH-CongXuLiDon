/* Mục "Đơn đã nộp" trên trang Thông tin cá nhân (như submittedTable trong artifact/js/profile.js):
   bảng các đơn của mình. Nút "Nộp đơn mới" mở hộp "Chọn loại đơn". */
import type { FormSummary } from '@ulaw/shared';
import { useMyForms } from '../../api/forms';
import { PAGE_LABEL } from '../../app/paths';
import { useCan } from '../../features/auth/useAuth';
import { loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { BASE_FORM_FIELDS, FormTable } from './FormTable';
import { NewFormButton } from './NewFormButton';
import styles from './ProfilePage.module.css';

/** Mảng rỗng dùng chung khi chưa tải xong, để bảng không bị tính lại mỗi lần vẽ. */
const NO_FORMS: FormSummary[] = [];

/**
 * Mục "Đơn đã nộp".
 * @returns  khung có tiêu đề, nút Nộp đơn mới (nếu có quyền nộp đơn), bảng đơn
 */
export function SubmittedForms() {
  const canSubmit = useCan('submit');
  const formsQuery = useMyForms();

  return (
    <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="submitted-forms-title">
      <div className={styles.sectionHead}>
        <div className={styles.titleGroup}>
          <h2 id="submitted-forms-title">Đơn đã nộp</h2>
          <RefreshButton query={formsQuery} label="Đơn đã nộp" size="small" />
        </div>
        {canSubmit && <NewFormButton previousPageLabel={PAGE_LABEL.profile} />}
      </div>

      <FormTable
        tableId="profile.submittedForms"
        fields={BASE_FORM_FIELDS}
        rows={formsQuery.data ?? NO_FORMS}
        isPending={formsQuery.isPending}
        errorMessage={loadErrorMessage(formsQuery)}
        searchPlaceholder="Tìm theo mã đơn, loại đơn, ngày nộp, trạng thái"
        searchLabel="Tìm đơn đã nộp"
        emptyText={canSubmit ? 'Chưa có đơn nào. Bấm “Nộp đơn mới” để tạo đơn.' : 'Chưa có đơn nào.'}
      />
    </section>
  );
}
