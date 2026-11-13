/* Hàng nút Yêu cầu bổ sung / Từ chối / Duyệt ở đáy trang chi tiết đơn Đang xét.
   Duyệt thực hiện ngay; Yêu cầu bổ sung và Từ chối mở hộp thoại ghi lí do (không bắt buộc). */
import { useState } from 'react';
import { FORM_MESSAGES, type FormDecision, type FormDetail } from '@ulaw/shared';
import { useDecideForm } from '../../api/form';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useUndoable } from '../../features/undo/UndoProvider';
import pageStyles from './FormPage.module.css';
import styles from './DecideBar.module.css';

/** Câu báo khi ra quyết định lỗi mà máy chủ không gửi kèm câu báo (vd mất mạng). */
const DECIDE_FAILED_TEXT = 'Chưa ra được quyết định. Kiểm tra kết nối mạng rồi thử lại.';

/** Quyết định cần ghi lí do, tức mọi quyết định trừ Duyệt. */
type DecisionWithNote = Exclude<FormDecision, 'duyet'>;

/** Tên hành động của từng quyết định, dùng trong thanh đếm ngược. */
const DECISION_LABELS: Record<FormDecision, string> = { duyet: 'Duyệt', bs: 'Yêu cầu bổ sung', tc: 'Từ chối' };

/* Chữ trong hộp thoại lí do của từng quyết định. */
const NOTE_DIALOGS: Record<DecisionWithNote, { title: string; subtitle: string; confirmLabel: string; confirmClassName: string | undefined }> = {
  bs: {
    title: 'Yêu cầu bổ sung đơn',
    subtitle: 'Đơn sẽ chuyển sang “Cần bổ sung” để người nộp sửa và gửi lại.',
    confirmLabel: 'Gửi yêu cầu bổ sung',
    confirmClassName: styles.confirmNeedSupplement,
  },
  tc: {
    title: 'Từ chối đơn',
    subtitle: 'Đơn sẽ chuyển sang “Từ chối”.',
    confirmLabel: 'Xác nhận từ chối',
    confirmClassName: styles.confirmReject,
  },
};

/**
 * Hàng nút quyết định dính đáy màn hình. Ra quyết định xong thì trang vẽ lại theo lá đơn mới và toast báo kết quả.
 * @param form  lá đơn Đang xét mà người xem được ra quyết định (canDecideOn)
 * @returns     hàng ba nút và hộp thoại ghi lí do
 */
export function DecideBar({ form }: { form: FormDetail }) {
  const toast = useToast();
  const decideForm = useDecideForm(form.code);
  const undoable = useUndoable();
  const isBusy = decideForm.isPending || undoable.isPending(form.code);
  // Quyết định đang chờ ghi lí do (hộp thoại mở); null = hộp thoại đóng
  const [pendingDecision, setPendingDecision] = useState<DecisionWithNote | null>(null);
  const [note, setNote] = useState('');
  const noteDialog = pendingDecision ? NOTE_DIALOGS[pendingDecision] : null;

  /**
   * Hẹn giờ gửi quyết định (10 giây, hoàn tác được); hộp thoại đóng ngay. Hết giờ thì gửi lên máy chủ,
   * xong thì báo kết quả, lỗi thì báo câu máy chủ gửi.
   * @param decision  quyết định
   * @param noteText  lí do ("" nếu không ghi, hoặc Duyệt)
   */
  const decide = (decision: FormDecision, noteText: string) => {
    setPendingDecision(null);
    undoable.run({
      key: form.code,
      message: `${DECISION_LABELS[decision]} đơn ${form.code}`,
      perform: () =>
        decideForm
          .mutateAsync({ decision, note: noteText })
          .then((decidedForm) => toast(FORM_MESSAGES.decided[decision](decidedForm.code), 'success'))
          .catch((error: Error) => toast(error.message || DECIDE_FAILED_TEXT, 'error')),
    });
  };

  /** Mở hộp thoại ghi lí do cho Yêu cầu bổ sung hoặc Từ chối, ô lí do để trống. */
  const askForNote = (decision: DecisionWithNote) => {
    setNote('');
    setPendingDecision(decision);
  };

  /** Đóng hộp thoại, không ra quyết định. */
  const closeDialog = () => setPendingDecision(null);

  // Hộp thoại đặt NGOÀI thanh nút: thanh nút có backdrop-filter nên sẽ giữ luôn vị trí của phần tử position:fixed nằm trong nó
  return (
    <>
      {/* data-avoid-floating-button: các nút tròn nổi (Ghi chú nội bộ…) không che thanh này (đứng lên trên khi chồng nhau) */}
      <div className={pageStyles.submitRow} data-avoid-floating-button>
        <div className={pageStyles.buttons}>
          <Button className={styles.needSupplement} onClick={() => askForNote('bs')} disabled={isBusy}>
            Yêu cầu bổ sung
          </Button>
          <Button className={styles.reject} onClick={() => askForNote('tc')} disabled={isBusy}>
            Từ chối
          </Button>
          <Button className={styles.approve} onClick={() => decide('duyet', '')} disabled={isBusy}>
            {decideForm.isPending ? 'Đang duyệt…' : 'Duyệt'}
          </Button>
        </div>
      </div>

      <Modal open={noteDialog !== null} onClose={closeDialog} title={noteDialog ? `${noteDialog.title} ${form.code}` : ''}>
        <p className={styles.dialogSubtitle}>{noteDialog?.subtitle}</p>
        <Field label="Lí do" hint="Người nộp đơn sẽ thấy nội dung này.">
          <textarea rows={4} placeholder="Nhập lí do (có thể bỏ trống)" value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <div className={styles.dialogButtons}>
          <Button variant="ghost" onClick={closeDialog}>
            Hủy
          </Button>
          <Button
            variant="primary"
            className={noteDialog?.confirmClassName}
            onClick={() => pendingDecision && decide(pendingDecision, note.trim())}
          >
            {noteDialog?.confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
