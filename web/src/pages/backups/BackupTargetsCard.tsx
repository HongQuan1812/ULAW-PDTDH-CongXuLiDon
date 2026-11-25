/* Mục "Nơi lưu" trong khung “Lịch và nơi lưu” của trang Sao lưu (thu gọn được, nút + để thêm nơi lưu):
   mỗi nơi một dòng (tên; kiểu, thư mục, giữ bao nhiêu, đang có bao nhiêu), nút Sửa.
   Kết nối, đổi tài khoản Google Drive làm trong hộp sửa; nơi Drive chưa có tài khoản thì có chữ báo kèm nút Kết nối (mở hộp sửa).
   Nút + mở hộp thêm; Bỏ nơi lưu nằm trong hộp sửa, hỏi lại trước khi bỏ. */
import { useState } from 'react';
import { BACKUP_MESSAGES, BACKUP_TARGET_KIND_LABEL, type BackupTarget, type BackupsResponse } from '@ulaw/shared';
import { useRemoveBackupTarget } from '../../api/backups';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { BackupTargetDialog } from './BackupTargetDialog';
import { PanelSection } from '../form/FormInfoPanel';
import styles from './BackupsPage.module.css';

/**
 * Nơi lưu này lưu vào được chưa (Google Drive phải kết nối tài khoản trước).
 * @param target  nơi lưu
 * @returns       true khi lưu được
 */
export function isTargetUsable(target: BackupTarget): boolean {
  return target.kind !== 'googleDrive' || target.googleAccount !== null;
}

/**
 * Dòng mô tả một nơi lưu, vd "Thư mục trên máy chủ · backups/hang-ngay · giữ 14 · có 3".
 * @param target  nơi lưu
 * @returns       câu mô tả
 */
export function targetMetaText(target: BackupTarget): string {
  const where =
    target.kind === 'serverFolder'
      ? `${BACKUP_TARGET_KIND_LABEL.serverFolder} · backups/${target.folder}`
      : `${BACKUP_TARGET_KIND_LABEL.googleDrive}${target.googleAccount ? ` · ${target.googleAccount}` : ''} · ${driveFolderText(target.folder)}`;
  return `${where} · giữ ${target.keepLatest} · có ${target.backupCount}`;
}

/**
 * Thư mục của nơi lưu Drive (chọn bằng Picker).
 * @param folder  tên thư mục đã lưu; trống = My Drive (nơi lưu cũ)
 * @returns       vd 'Thư mục WorkingSpace', 'My Drive'
 */
function driveFolderText(folder: string): string {
  return folder ? `Thư mục ${folder}` : 'My Drive';
}

/**
 * Mô tả một nơi lưu ở thẻ Nơi lưu, ba dòng: loại nơi lưu (Drive kèm tài khoản), thư mục, giữ bao nhiêu / đang có bao nhiêu.
 * @param target  nơi lưu
 * @returns       vd ['Google Drive · an@gmail.com', 'Thư mục Sao lưu cổng', 'Giữ 14 bản · đang có 3']
 */
function targetMetaLines(target: BackupTarget): string[] {
  const kindLine = target.kind === 'googleDrive' && target.googleAccount ? `${BACKUP_TARGET_KIND_LABEL.googleDrive} · ${target.googleAccount}` : BACKUP_TARGET_KIND_LABEL[target.kind];
  const folderLine = target.kind === 'serverFolder' ? `backups/${target.folder}` : driveFolderText(target.folder);
  return [kindLine, folderLine, `Giữ ${target.keepLatest} bản · đang có ${target.backupCount}`];
}

/**
 * Câu báo lỗi của một lệnh.
 * @param error  lỗi bắt được
 * @returns      câu báo của máy chủ, hoặc câu chung
 */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : BACKUP_MESSAGES[422];
}

/**
 * Thẻ Nơi lưu.
 * @param overview  tổng quan (các nơi lưu, máy chủ có OAuth Google chưa)
 * @param editing   hộp thêm / sửa: undefined = đóng, null = thêm mới, nơi lưu = sửa nơi đó (trang giữ, để popup Sao lưu ngay mở được hộp thêm)
 * @param onEdit    mở / đóng hộp thêm / sửa
 * @returns         thẻ
 */
export function BackupTargetsCard({
  overview,
  editing,
  onEdit,
}: {
  overview: BackupsResponse;
  editing: BackupTarget | null | undefined;
  onEdit: (target: BackupTarget | null | undefined) => void;
}) {
  const toast = useToast();
  const removeTarget = useRemoveBackupTarget();
  const [removing, setRemoving] = useState<BackupTarget | null>(null);

  /** Bỏ nơi lưu đang hỏi. */
  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await removeTarget.mutateAsync(removing.id);
      toast(BACKUP_MESSAGES.targetRemoved, 'success');
      setRemoving(null);
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  return (
    <PanelSection title="Nơi lưu" count={overview.targets.length} add={{ label: 'Thêm nơi lưu', onClick: () => onEdit(null) }} storageKey="backupsPanel.targets.collapsed" tightBody>
      {overview.targets.length === 0 ? (
        <p className={styles.emptyNote}>Chưa có nơi lưu nào. Vẫn tải bản sao lưu về máy được.</p>
      ) : (
        <ul className={styles.itemList}>
          {overview.targets.map((target) => (
            <li key={target.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemTitle}>{target.name}</span>
                {targetMetaLines(target).map((line, index) => (
                  <span key={line} className={styles.targetMeta}>
                    {/* dòng thứ hai là thư mục: Drive đã có thư mục thì bấm để mở trên Drive */}
                    {index === 1 && target.driveFolderUrl ? (
                      <a href={target.driveFolderUrl} target="_blank" rel="noopener noreferrer" className={styles.folderLink} title="Mở thư mục trên Google Drive">
                        {line} ↗
                      </a>
                    ) : (
                      line
                    )}
                  </span>
                ))}
                {target.kind === 'googleDrive' && !target.googleAccount && (
                  <span className={styles.warning}>
                    Chưa kết nối tài khoản Google ·{' '}
                    <button type="button" className={styles.linkButton} onClick={() => onEdit(target)}>
                      Kết nối
                    </button>
                  </span>
                )}
              </div>
              <button type="button" className={styles.linkButton} onClick={() => onEdit(target)} aria-label={`Sửa nơi lưu ${target.name}`}>
                Sửa
              </button>
            </li>
          ))}
        </ul>
      )}
      {!overview.googleDriveAvailable && <p className={styles.warning}>{BACKUP_MESSAGES.driveUnavailable}</p>}

      <BackupTargetDialog
        open={editing !== undefined}
        target={editing ?? null}
        onClose={() => onEdit(undefined)}
        onRemove={(target) => {
          onEdit(undefined);
          setRemoving(target);
        }}
      />

      <Modal open={removing !== null} onClose={() => setRemoving(null)} title={`Bỏ nơi lưu “${removing?.name ?? ''}”?`}>
        <div className={styles.dialogBody}>
          <p className={styles.dialogText}>Lịch định kì sẽ không lưu vào đây nữa. Các bản đã lưu ở đó không bị xóa, lịch sử vẫn giữ nguyên.</p>
          <div className={styles.dialogButtons}>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={() => void confirmRemove()} disabled={removeTarget.isPending}>
              {removeTarget.isPending ? 'Đang bỏ…' : 'Bỏ nơi lưu'}
            </Button>
          </div>
        </div>
      </Modal>
    </PanelSection>
  );
}
