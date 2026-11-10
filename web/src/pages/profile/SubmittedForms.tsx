/* Mục "Đơn đã nộp" trên trang Thông tin cá nhân (như submittedTable trong artifact/js/profile.js):
   bảng các đơn của mình. Nút "Nộp đơn mới" mở hộp "Chọn loại đơn". */
import { useCallback, useState } from 'react';
import { FORM_TYPE_MESSAGES, type FormSummary } from '@ulaw/shared';
import { useOpenFormTypes } from '../../api/form-types';
import { useMyForms } from '../../api/forms';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { useCan } from '../../features/auth/useAuth';
import { BASE_FORM_FIELDS, FormTable } from './FormTable';
import { FormTypePicker } from './FormTypePicker';
import styles from './ProfilePage.module.css';

/** Mảng rỗng dùng chung khi chưa tải xong, để bảng không bị tính lại mỗi lần vẽ. */
const NO_FORMS: FormSummary[] = [];

/**
 * Mục "Đơn đã nộp".
 * @returns  khung có tiêu đề, nút Nộp đơn mới (nếu có quyền nộp đơn), bảng đơn
 */
export function SubmittedForms() {
  const canSubmit = useCan('submit');
  const toast = useToast();
  const formsQuery = useMyForms();
  // Tải sẵn các loại đơn đang mở (chỉ khi có quyền nộp đơn), để bấm "Nộp đơn mới" là có ngay
  const openFormTypesQuery = useOpenFormTypes(canSubmit);
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  // Nộp đơn mới: không có loại đơn nào đang mở thì chỉ báo; còn lại mở hộp chọn loại đơn
  // (chưa tải xong hoặc lỗi thì hộp hiện đang tải / câu báo lỗi)
  const openPicker = () => {
    if (openFormTypesQuery.isSuccess && openFormTypesQuery.data.length === 0) {
      toast(FORM_TYPE_MESSAGES.noneOpen);
      return;
    }
    setPickerOpen(true);
  };

  return (
    <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="submitted-forms-title">
      <div className={styles.sectionHead}>
        <h2 id="submitted-forms-title">Đơn đã nộp</h2>
        {canSubmit && (
          <Button variant="primary" aria-haspopup="dialog" onClick={openPicker}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nộp đơn mới
          </Button>
        )}
      </div>

      <FormTable
        tableId="profile.submittedForms"
        fields={BASE_FORM_FIELDS}
        rows={formsQuery.data ?? NO_FORMS}
        isPending={formsQuery.isPending}
        errorMessage={formsQuery.isError ? formsQuery.error.message : null}
        searchPlaceholder="Tìm theo mã đơn, loại đơn, ngày nộp, trạng thái"
        searchLabel="Tìm đơn đã nộp"
        emptyText={canSubmit ? 'Chưa có đơn nào. Bấm “Nộp đơn mới” để tạo đơn.' : 'Chưa có đơn nào.'}
      />

      {canSubmit && (
        <FormTypePicker
          open={pickerOpen}
          onClose={closePicker}
          formTypes={openFormTypesQuery.data}
          loadError={openFormTypesQuery.isError ? openFormTypesQuery.error.message : null}
        />
      )}
    </section>
  );
}
