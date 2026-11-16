/* Hộp thoại "Thêm nơi lưu" / "Sửa nơi lưu": kiểu (thư mục trên máy chủ / Google Drive, chọn bằng hai thẻ), tên, thư mục, giữ bao nhiêu bản.
   Thư mục máy chủ nằm trong thư mục sao lưu (BACKUP_DIR) nên ô nhập có chữ "backups/" đứng trước.
   Google Drive: ô "Kết nối Google Drive" có nút Kết nối Google; kết nối xong hiện email (kèm nút Đổi tài khoản), rồi bấm Lưu.
   Chưa kết nối thì không lưu được. Đang sửa thì có nút "Bỏ nơi lưu" (hỏi lại ở hộp khác). */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  BACKUP_MESSAGES,
  BACKUP_TARGET_KINDS,
  BACKUP_TARGET_KIND_LABEL,
  BackupTargetInputSchema,
  type BackupTarget,
  type BackupTargetInput,
  type BackupTargetKind,
} from '@ulaw/shared';
import { useConnectGoogleDrive, useSaveBackupTarget, type DriveConnection } from '../../api/backups';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../features/auth/useAuth';
import { SHOW_DEMO } from '../../lib/env';
import styles from './BackupsPage.module.css';

/** Nơi lưu mới: thư mục trên máy chủ, giữ 14 bản. */
const NEW_TARGET: BackupTargetInput = { name: '', kind: 'serverFolder', folder: '', keepLatest: 14 };

/** Chữ theo kiểu nơi lưu: dòng giải thích ở thẻ kiểu, gợi ý các ô. */
const KIND_TEXT: Record<BackupTargetKind, { hint: string; namePlaceholder: string; folderLabel: string; folderPlaceholder: string; folderHint: string }> = {
  serverFolder: {
    hint: 'Lưu trên ổ đĩa của máy chủ',
    namePlaceholder: 'vd Ổ máy chủ · hằng ngày',
    folderLabel: 'Thư mục trên máy chủ',
    folderPlaceholder: 'hang-ngay',
    folderHint: 'Chữ không dấu, số, - và _, các cấp cách nhau bằng /.',
  },
  googleDrive: {
    hint: 'Lưu lên Drive của một tài khoản Google',
    namePlaceholder: 'vd Drive phòng',
    folderLabel: 'Thư mục trên Drive',
    folderPlaceholder: 'vd Công việc/Sao lưu cổng',
    folderHint:
      'Tính từ My Drive, các cấp cách nhau bằng /; để trống thì lưu thẳng vào My Drive. Cấp nào chưa có thì cổng tự tạo ở lần sao lưu đầu tiên. ' +
      'Cổng chỉ thấy thư mục do chính nó tạo: gõ trùng tên một thư mục cậu tự tạo sẵn thì cổng tạo thêm một thư mục mới cùng tên.',
  },
};

interface BackupTargetDialogProps {
  open: boolean;
  /** Nơi lưu cần sửa; null = thêm mới */
  target: BackupTarget | null;
  onClose: () => void;
  /** Bấm "Bỏ nơi lưu" (chỉ khi đang sửa): nơi gọi đóng hộp này rồi hỏi lại */
  onRemove: (target: BackupTarget) => void;
}

/**
 * Hộp thoại thêm / sửa nơi lưu.
 * @param props  xem BackupTargetDialogProps
 * @returns      hộp thoại
 */
export function BackupTargetDialog({ open, target, onClose, onRemove }: BackupTargetDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={target ? 'Sửa nơi lưu' : 'Thêm nơi lưu'}>
      {open && <BackupTargetForm key={target?.id ?? 'new'} target={target} onClose={onClose} onRemove={onRemove} />}
    </Modal>
  );
}

/**
 * Form nơi lưu.
 * @param target    nơi lưu cần sửa; null = thêm mới
 * @param onClose   gọi khi bấm Hủy hoặc lưu xong
 * @param onRemove  gọi khi bấm Bỏ nơi lưu
 * @returns         form
 */
function BackupTargetForm({ target, onClose, onRemove }: Omit<BackupTargetDialogProps, 'open'>) {
  const toast = useToast();
  const saveTarget = useSaveBackupTarget();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<BackupTargetInput>({
    resolver: zodResolver(BackupTargetInputSchema),
    defaultValues: target ? { name: target.name, kind: target.kind, folder: target.folder, keepLatest: target.keepLatest } : NEW_TARGET,
  });
  const kind = watch('kind');
  const kindText = KIND_TEXT[kind];

  // Tài khoản Google: vừa kết nối trong hộp này, hoặc tài khoản cũ của nơi Drive đang sửa
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const driveAccount = connection?.email ?? (target?.kind === 'googleDrive' ? target.googleAccount : null);

  /**
   * Kết nối xong: nhớ driveGrantId để gửi kèm khi Lưu.
   * @param connected  tài khoản vừa kết nối
   */
  const onConnected = (connected: DriveConnection) => {
    setConnection(connected);
    setValue('driveGrantId', connected.driveGrantId);
    clearErrors('driveGrantId');
  };

  // Lưu: Drive phải có tài khoản; trùng thư mục (409) báo dưới ô thư mục; kết nối hết hạn thì bỏ để kết nối lại
  const onSubmit = handleSubmit(async (input) => {
    if (input.kind === 'googleDrive' && !driveAccount) {
      setError('driveGrantId', { message: BACKUP_MESSAGES.driveConnectFirst });
      return;
    }
    try {
      await saveTarget.mutateAsync({ input: input.kind === 'googleDrive' ? input : { ...input, driveGrantId: undefined }, targetId: target?.id });
      toast(target ? BACKUP_MESSAGES.targetSaved : BACKUP_MESSAGES.targetAdded, 'success');
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : BACKUP_MESSAGES[422];
      if (error instanceof ApiError && error.status === 409) setError('folder', { message });
      else if (message === BACKUP_MESSAGES.driveGrantExpired) {
        setConnection(null);
        setValue('driveGrantId', undefined);
        setError('driveGrantId', { message });
      } else toast(message, 'error');
    }
  });

  return (
    <form className={styles.dialogBody} onSubmit={onSubmit} noValidate>
      <fieldset className={styles.plain}>
        <legend>Kiểu</legend>
        <div className={styles.kindCards}>
          {BACKUP_TARGET_KINDS.map((targetKind) => (
            <label key={targetKind} className={styles.kindCard}>
              <input type="radio" value={targetKind} {...register('kind')} />
              <span>
                <strong>{BACKUP_TARGET_KIND_LABEL[targetKind]}</strong>
                <small>{KIND_TEXT[targetKind].hint}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Tên nơi lưu" required error={errors.name?.message}>
        <input {...register('name')} placeholder={kindText.namePlaceholder} aria-invalid={!!errors.name} />
      </Field>

      <Field label={kindText.folderLabel} required={kind === 'serverFolder'} hint={kindText.folderHint} error={errors.folder?.message}>
        {kind === 'serverFolder' ? (
          <span className={styles.prefixInput}>
            <span aria-hidden="true">backups/</span>
            <input {...register('folder')} placeholder={kindText.folderPlaceholder} aria-invalid={!!errors.folder} />
          </span>
        ) : (
          <span className={styles.prefixInput}>
            <span aria-hidden="true">My Drive/</span>
            <input {...register('folder')} placeholder={kindText.folderPlaceholder} aria-invalid={!!errors.folder} />
          </span>
        )}
      </Field>

      <Field label="Giữ bao nhiêu bản gần nhất" required hint="Bản cũ hơn tự xóa sau mỗi lần sao lưu thành công." error={errors.keepLatest?.message}>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          className={styles.keepInput}
          {...register('keepLatest', { valueAsNumber: true })}
          aria-invalid={!!errors.keepLatest}
        />
      </Field>

      {kind === 'googleDrive' && <DriveAccountField account={driveAccount} error={errors.driveGrantId?.message} onConnected={onConnected} />}

      <div className={styles.dialogButtons}>
        {target && (
          <Button variant="danger" onClick={() => onRemove(target)}>
            Bỏ nơi lưu
          </Button>
        )}
        <span className={styles.spacer} />
        <Button variant="ghost" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" disabled={saveTarget.isPending}>
          {saveTarget.isPending ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Ô "Kết nối Google Drive" của nơi lưu Drive: chưa kết nối thì nút Kết nối Google; đã kết nối thì email kèm nút Đổi tài khoản.
 * Bấm Kết nối: VITE_APP_ENV = "dev" thì hiện khung giả lập chọn tài khoản (JUST FOR DEMO); không thì gọi máy chủ ngay
 * (bản thật mở cửa sổ Google).
 * @param account      email đang kết nối; null = chưa
 * @param error        câu báo dưới ô (chưa kết nối, kết nối hết hạn)
 * @param onConnected  gọi khi kết nối xong
 * @returns            ô tài khoản
 */
function DriveAccountField({ account, error, onConnected }: { account: string | null; error?: string; onConnected: (connected: DriveConnection) => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const connectDrive = useConnectGoogleDrive();
  const [choosing, setChoosing] = useState(false);
  const [demoEmail, setDemoEmail] = useState(user.email);

  /**
   * Gọi máy chủ kết nối, báo kết quả.
   * @param email  chỉ bản giả: email giả làm tài khoản Google
   */
  const connect = async (email?: string) => {
    try {
      const connected = await connectDrive.mutateAsync(email ? { email } : {});
      setChoosing(false);
      onConnected(connected);
      toast(BACKUP_MESSAGES.driveConnected(connected.email), 'success');
    } catch (connectError) {
      toast(connectError instanceof Error ? connectError.message : BACKUP_MESSAGES[422], 'error');
    }
  };

  return (
    <div className={styles.fieldLabel}>
      <span>
        Kết nối Google Drive <span className={styles.requiredMark}>*</span>
      </span>
      {choosing ? (
        /* JUST FOR DEMO: START · khung giả lập trang chọn tài khoản của Google, chỉ hiện khi VITE_APP_ENV = "dev".
           Bản thật: bấm Kết nối Google mở cửa sổ Google, chọn tài khoản xong cửa sổ tự đóng và báo email về đây */
        <div className={styles.demoGoogle}>
          <strong>Chọn tài khoản Google (giả lập)</strong>
          <span className={styles.fieldHint}>Gõ email bất kì để thử. Nếu máy chủ đang dùng bản thật, bấm Tiếp tục sẽ mở cửa sổ Google (email ở đây bỏ qua).</span>
          <input type="email" value={demoEmail} onChange={(event) => setDemoEmail(event.target.value)} aria-label="Email tài khoản Google" />
          <div className={styles.dialogButtons}>
            <Button variant="ghost" onClick={() => setChoosing(false)} disabled={connectDrive.isPending}>
              Hủy
            </Button>
            <Button variant="primary" onClick={() => void connect(demoEmail)} disabled={connectDrive.isPending || !demoEmail.trim()}>
              {connectDrive.isPending ? 'Đang kết nối…' : 'Tiếp tục'}
            </Button>
          </div>
        </div>
      ) : /* JUST FOR DEMO: END */ account ? (
        <div className={styles.driveAccount}>
          <span className={styles.driveAccountEmail}>
            <i aria-hidden="true">✓</i>
            {account}
          </span>
          <button type="button" className={styles.linkButton} onClick={() => (SHOW_DEMO ? setChoosing(true) : void connect())} disabled={connectDrive.isPending}>
            {connectDrive.isPending ? 'Đang kết nối…' : 'Đổi tài khoản'}
          </button>
        </div>
      ) : (
        <div>
          <Button onClick={() => (SHOW_DEMO ? setChoosing(true) : void connect())} disabled={connectDrive.isPending}>
            {connectDrive.isPending ? 'Đang kết nối…' : 'Kết nối Google'}
          </Button>
        </div>
      )}
      {!choosing && <span className={styles.fieldHint}>Mỗi nơi lưu một tài khoản riêng. Cổng chỉ thấy các tệp, thư mục do chính nó tạo trên Drive.</span>}
      {error && (
        <span className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
