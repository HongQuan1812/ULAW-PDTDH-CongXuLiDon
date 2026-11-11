/* Nút "Nộp đơn mới" ở đầu mục "Đơn đã nộp" và hộp "Chọn loại đơn" đi kèm (như #newBtn của artifact/js/profile.js):
   trên trang Thông tin cá nhân thì nộp đơn của mình, trên trang thông tin người khác thì nộp thay cho người đó (Admin). */
import { useCallback, useState } from 'react';
import { FORM_TYPE_MESSAGES } from '@ulaw/shared';
import { useOpenFormTypes } from '../../api/form-types';
import { Button } from '../../components/Button';
import { loadErrorMessage } from '../../components/LoadError';
import { useToast } from '../../components/Toast';
import { FormTypePicker } from './FormTypePicker';

/**
 * Nút Nộp đơn mới kèm hộp chọn loại đơn. Các loại đơn đang mở được tải sẵn, để bấm là có ngay.
 * @param applicantId        nộp thay: id người nộp đơn; bỏ trống = đơn của mình
 * @param previousPageLabel  tên trang đang mở nút, hiện trên nút "‹ Quay lại …" của trang nộp đơn
 * @returns                  nút và hộp thoại
 */
export function NewFormButton({ applicantId, previousPageLabel }: { applicantId?: string; previousPageLabel: string }) {
  const toast = useToast();
  const openFormTypesQuery = useOpenFormTypes(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  // Nộp đơn mới: không có loại đơn nào đang mở thì chỉ báo; còn lại mở hộp chọn loại đơn
  // (chưa tải xong hoặc lỗi thì hộp hiện đang tải / câu báo lỗi; lần trước lỗi thì tải lại khi mở)
  const openPicker = () => {
    if (openFormTypesQuery.isError) void openFormTypesQuery.refetch();
    if (openFormTypesQuery.isSuccess && openFormTypesQuery.data.length === 0) {
      toast(FORM_TYPE_MESSAGES.noneOpen);
      return;
    }
    setPickerOpen(true);
  };

  return (
    <>
      <Button variant="primary" aria-haspopup="dialog" onClick={openPicker}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nộp đơn mới
      </Button>
      <FormTypePicker
        open={pickerOpen}
        onClose={closePicker}
        formTypes={openFormTypesQuery.data}
        loadError={loadErrorMessage(openFormTypesQuery)}
        applicantId={applicantId}
        previousPageLabel={previousPageLabel}
      />
    </>
  );
}
