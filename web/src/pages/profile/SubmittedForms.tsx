/* Mục "Đơn đã nộp" trên trang Thông tin cá nhân (như submittedTable trong artifact/js/profile.js):
   bảng các đơn của mình, tải từng trang. Nút "Nộp đơn mới" mở hộp "Chọn loại đơn". */
import { FORM_LIST_FIELDS } from '@ulaw/shared';
import { MY_FORMS_SOURCE } from '../../api/forms';
import { PAGE_LABEL } from '../../app/paths';
import { useCan } from '../../features/auth/useAuth';
import { RefreshButton } from '../../components/RefreshButton';
import { useServerTable } from '../../components/table/useServerTable';
import { FORM_PAGE_SIZE, FormTable } from './FormTable';
import { NewFormButton } from './NewFormButton';
import styles from './ProfilePage.module.css';

/**
 * Mục "Đơn đã nộp".
 * @returns  khung có tiêu đề, nút Nộp đơn mới (nếu có quyền nộp đơn), bảng đơn
 */
export function SubmittedForms() {
  const canSubmit = useCan('submit');
  const formsTable = useServerTable({ tableId: 'profile.submittedForms', source: MY_FORMS_SOURCE, pageSize: FORM_PAGE_SIZE });

  return (
    <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="submitted-forms-title">
      <div className={styles.sectionHead}>
        <div className={styles.titleGroup}>
          <h2 id="submitted-forms-title">Đơn đã nộp</h2>
          <RefreshButton query={formsTable.pageQuery} label="Đơn đã nộp" size="small" />
        </div>
        {canSubmit && <NewFormButton previousPageLabel={PAGE_LABEL.profile} />}
      </div>

      <FormTable
        table={formsTable}
        fields={FORM_LIST_FIELDS}
        searchPlaceholder="Tìm theo mã đơn, loại đơn, ngày nộp, trạng thái"
        searchLabel="Tìm đơn đã nộp"
        emptyText={canSubmit ? 'Chưa có đơn nào. Bấm “Nộp đơn mới” để tạo đơn.' : 'Chưa có đơn nào.'}
      />
    </section>
  );
}
