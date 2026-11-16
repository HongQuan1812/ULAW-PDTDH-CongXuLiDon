/* Popup "Sao lưu ngay": chọn nhiều nơi lưu, hoặc chỉ tải về máy này.
   Ô "Tải về máy này" nằm trên cùng; tích ô này thì các nơi lưu bị khóa (tải về chỉ đi một mình, để trình duyệt hỏi lưu tệp không lẫn với việc khác),
   bỏ tích thì các nơi đã chọn trước đó trở lại. Nơi lưu Google Drive chưa kết nối thì không chọn được. */
import { useState } from 'react';
import type { BackupsResponse } from '@ulaw/shared';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { isTargetUsable, targetMetaText } from './BackupTargetsCard';
import styles from './BackupsPage.module.css';

interface RunBackupDialogProps {
  open: boolean;
  overview: BackupsResponse;
  onClose: () => void;
  /** Sao lưu vào các nơi đã chọn; trả true khi máy chủ đã nhận (đóng popup), false khi lỗi (giữ popup) */
  onRun: (targetIds: string[]) => Promise<boolean>;
  /** Tải về máy này (trang đóng popup rồi tải) */
  onDownload: () => void;
  /** Chưa có nơi lưu nào: bấm "Thêm nơi lưu" */
  onAddTarget: () => void;
}

/**
 * Popup Sao lưu ngay.
 * @param props  xem RunBackupDialogProps
 * @returns      hộp thoại
 */
export function RunBackupDialog(props: RunBackupDialogProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} title="Sao lưu ngay">
      {props.open && <RunBackupForm {...props} />}
    </Modal>
  );
}

/**
 * Nội dung popup. Mở ra thì chọn sẵn các nơi của các lịch đang bật (lưu vào được).
 * @param props  xem RunBackupDialogProps
 * @returns      danh sách chọn và nút xác nhận
 */
function RunBackupForm({ overview, onClose, onRun, onDownload, onAddTarget }: RunBackupDialogProps) {
  const [downloadChosen, setDownloadChosen] = useState(false);
  const [chosenIds, setChosenIds] = useState<string[]>(() => [...new Set(overview.schedules.filter((schedule) => schedule.enabled).flatMap((schedule) => schedule.targetIds))]);
  const [sending, setSending] = useState(false);

  // Chỉ tính các nơi còn có và lưu vào được
  const usableIds = overview.targets.filter(isTargetUsable).map((target) => target.id);
  const runIds = chosenIds.filter((id) => usableIds.includes(id));
  const canConfirm = !sending && (downloadChosen || runIds.length > 0);
  const confirmLabel = downloadChosen ? 'Tải về máy' : sending ? 'Đang bắt đầu…' : runIds.length === 0 ? 'Chọn ít nhất một nơi' : `Sao lưu vào ${runIds.length} nơi`;

  /**
   * Tích / bỏ tích một nơi lưu.
   * @param targetId  id nơi lưu
   */
  const toggle = (targetId: string) =>
    setChosenIds((current) => (current.includes(targetId) ? current.filter((id) => id !== targetId) : [...current, targetId]));

  /** Bấm nút xác nhận: tải về, hoặc sao lưu vào các nơi đã chọn. */
  const confirm = async () => {
    if (downloadChosen) {
      onDownload();
      return;
    }
    setSending(true);
    const started = await onRun(runIds);
    setSending(false);
    if (started) onClose();
  };

  return (
    <div className={styles.dialogBody}>
      <p className={styles.dialogText}>Tạo một bản rồi lưu vào các nơi đã chọn, hoặc chỉ tải về máy này.</p>
      {overview.targets.length === 0 && (
        <p className={styles.dialogText}>
          Chưa có nơi lưu nào.{' '}
          <button type="button" className={styles.linkButton} onClick={onAddTarget}>
            Thêm nơi lưu
          </button>
        </p>
      )}

      <div className={styles.choiceList} role="group" aria-label="Lưu vào">
        <label className={`${styles.choice} ${styles.choiceDownload}`}>
          <input type="checkbox" checked={downloadChosen} onChange={() => setDownloadChosen(!downloadChosen)} />
          <span className={styles.choiceText}>
            <span className={styles.choiceName}>Tải về máy này</span>
            <span className={styles.choiceMeta}>Chỉ tải một bản về máy đang dùng, không lưu vào nơi nào khác</span>
          </span>
        </label>
        {overview.targets.map((target) => {
          const usable = isTargetUsable(target);
          const disabled = !usable || downloadChosen;
          return (
            <label key={target.id} className={styles.choice} data-disabled={disabled}>
              <input type="checkbox" checked={!disabled && chosenIds.includes(target.id)} disabled={disabled} onChange={() => toggle(target.id)} />
              <span className={styles.choiceText}>
                <span className={styles.choiceName}>{target.name}</span>
                <span className={`${styles.choiceMeta} ${usable ? '' : styles.choiceWarn}`}>
                  {!usable
                    ? 'Chưa kết nối tài khoản Google, chưa lưu vào đây được'
                    : downloadChosen
                      ? 'Bỏ chọn “Tải về máy này” để chọn nơi này'
                      : targetMetaText(target)}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className={styles.dialogButtons}>
        <Button variant="ghost" onClick={onClose}>
          Hủy
        </Button>
        <Button variant="primary" onClick={() => void confirm()} disabled={!canConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
