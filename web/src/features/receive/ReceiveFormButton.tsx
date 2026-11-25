/* Nút "Tiếp nhận" một lá đơn đang chờ (Đã nộp / Đã bổ sung), dùng ở đầu trang chi tiết đơn và trong bảng Quản lí đơn.
   Bấm thì đơn chuyển sang Đang xét, mình thành người tiếp nhận và người xử lí; trang / bảng tự cập nhật (useReceiveForm), toast ghi giờ tiếp nhận. */
import { FORM_MESSAGES } from '@ulaw/shared';
import { useReceiveForm } from '../../api/form';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { formatDateTime } from '../../lib/format';

/** Câu báo khi không tiếp nhận được mà máy chủ không gửi kèm câu báo lỗi (vd mất mạng). */
const RECEIVE_FAILED_TEXT = 'Chưa tiếp nhận được đơn. Kiểm tra kết nối mạng rồi bấm Tiếp nhận lại.';

/**
 * Nút Tiếp nhận.
 * @param code       mã đơn đang chờ tiếp nhận
 * @param className  class đặt cỡ nút theo chỗ đặt
 * @param inRow      true: nút nằm trong một dòng bảng bấm được, bấm nút (chuột hay bàn phím) không mở trang chi tiết của dòng
 * @returns          nút bấm; đang gửi thì khóa nút, ghi "Đang tiếp nhận…"
 */
export function ReceiveFormButton({ code, className, inRow = false }: { code: string; className?: string; inRow?: boolean }) {
  const toast = useToast();
  const receive = useReceiveForm(code);

  /** Gửi lên máy chủ; xong thì báo giờ tiếp nhận, lỗi thì báo câu máy chủ gửi. */
  const receiveForm = () =>
    receive.mutate(undefined, {
      onSuccess: (receivedForm) =>
        toast(FORM_MESSAGES.received(receivedForm.code, formatDateTime(receivedForm.receivedAt ?? receivedForm.updatedAt)), 'success'),
      onError: (error) => toast(error.message || RECEIVE_FAILED_TEXT, 'error'),
    });

  return (
    <Button
      variant="primary"
      className={className}
      disabled={receive.isPending}
      onClick={(event) => {
        if (inRow) event.stopPropagation();
        receiveForm();
      }}
      onKeyDown={inRow ? (event) => event.stopPropagation() : undefined}
    >
      {receive.isPending ? 'Đang tiếp nhận…' : 'Tiếp nhận'}
    </Button>
  );
}
