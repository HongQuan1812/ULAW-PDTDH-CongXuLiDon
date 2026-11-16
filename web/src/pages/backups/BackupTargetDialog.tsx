/* Hộp thoại "Thêm nơi lưu" / "Sửa nơi lưu": tên, kiểu (thư mục trên máy chủ / Google Drive), thư mục, giữ bao nhiêu bản.
   Google Drive: lưu xong thì bấm "Kết nối Google Drive" ở dòng nơi lưu đó để cấp quyền. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  BACKUP_MESSAGES,
  BACKUP_TARGET_KINDS,
  BACKUP_TARGET_KIND_LABEL,
  BackupTargetInputSchema,
  type BackupTarget,
  type BackupTargetInput,
} from '@ulaw/shared';
import { useSaveBackupTarget } from '../../api/backups';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import styles from './BackupsPage.module.css';

/** Nơi lưu mới: thư mục trên máy chủ, giữ 14 bản. */
const NEW_TARGET: BackupTargetInput = { name: '', kind: 'serverFolder', folder: '', keepLatest: 14 };

interface BackupTargetDialogProps {
  open: boolean;
  /** Nơi lưu cần sửa; null = thêm mới */
  target: BackupTarget | null;
  onClose: () => void;
}

/**
 * Hộp thoại thêm / sửa nơi lưu.
 * @param props  xem BackupTargetDialogProps
 * @returns      hộp thoại
 */
export function BackupTargetDialog({ open, target, onClose }: BackupTargetDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={target ? 'Sửa nơi lưu' : 'Thêm nơi lưu'}>
      {open && <BackupTargetForm key={target?.id ?? 'new'} target={target} onClose={onClose} />}
    </Modal>
  );
}

/**
 * Form nơi lưu.
 * @param target   nơi lưu cần sửa; null = thêm mới
 * @param onClose  gọi khi bấm Hủy hoặc lưu xong
 * @returns        form
 */
function BackupTargetForm({ target, onClose }: { target: BackupTarget | null; onClose: () => void }) {
  const toast = useToast();
  const saveTarget = useSaveBackupTarget();
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<BackupTargetInput>({
    resolver: zodResolver(BackupTargetInputSchema),
    defaultValues: target ? { name: target.name, kind: target.kind, folder: target.folder, keepLatest: target.keepLatest } : NEW_TARGET,
  });
  const kind = watch('kind');

  // Lưu; trùng thư mục với nơi khác (409) thì báo dưới ô thư mục
  const onSubmit = handleSubmit(async (input) => {
    try {
      await saveTarget.mutateAsync({ input, targetId: target?.id });
      toast(target ? BACKUP_MESSAGES.targetSaved : BACKUP_MESSAGES.targetAdded, 'success');
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : BACKUP_MESSAGES[422];
      if (error instanceof ApiError && error.status === 409) setError('folder', { message });
      else toast(message, 'error');
    }
  });

  return (
    <form className={styles.dialogForm} onSubmit={onSubmit} noValidate>
      <Field label="Tên nơi lưu" required error={errors.name?.message}>
        <input {...register('name')} placeholder="vd Ổ thứ hai, Drive phòng Đào tạo" />
      </Field>
      <Field label="Kiểu" required>
        <select {...register('kind')}>
          {BACKUP_TARGET_KINDS.map((targetKind) => (
            <option key={targetKind} value={targetKind}>
              {BACKUP_TARGET_KIND_LABEL[targetKind]}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={kind === 'googleDrive' ? 'Thư mục trên Drive' : 'Thư mục con'}
        required
        hint={
          kind === 'googleDrive'
            ? 'Tên thư mục trên Drive của tài khoản sẽ kết nối; chưa có thì cổng tự tạo.'
            : 'Nằm trong thư mục sao lưu của máy chủ (BACKUP_DIR), vd hang-ngay. Chỉ chữ không dấu, số, - và _.'
        }
        error={errors.folder?.message}
      >
        <input {...register('folder')} placeholder={kind === 'googleDrive' ? 'vd Sao lưu cổng xử lí đơn' : 'vd hang-ngay'} />
      </Field>
      <Field label="Giữ bao nhiêu bản gần nhất" required hint="Bản cũ hơn tự xóa sau mỗi lần sao lưu thành công." error={errors.keepLatest?.message}>
        <input type="number" inputMode="numeric" min={1} {...register('keepLatest', { valueAsNumber: true })} />
      </Field>
      {kind === 'googleDrive' && !target?.googleAccount && (
        <p className={styles.dialogText}>Lưu xong, bấm “Kết nối Google Drive” ở nơi lưu này để cấp quyền cho cổng.</p>
      )}
      <div className={styles.dialogButtons}>
        <Button variant="ghost" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" disabled={saveTarget.isPending}>
          {saveTarget.isPending ? 'Đang lưu…' : target ? 'Lưu' : 'Thêm'}
        </Button>
      </div>
    </form>
  );
}
