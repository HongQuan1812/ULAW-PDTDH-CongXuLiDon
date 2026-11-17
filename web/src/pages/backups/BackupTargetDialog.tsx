/* Hộp thoại "Thêm nơi lưu" / "Sửa nơi lưu": kiểu (thư mục trên máy chủ / Google Drive, chọn bằng hai thẻ), tên, thư mục, giữ bao nhiêu bản.
   Thư mục máy chủ nằm trong thư mục sao lưu (BACKUP_DIR) nên ô nhập có chữ "backups/" đứng trước.
   Google Drive: ô "Kết nối Google Drive" có nút Kết nối Google; kết nối xong hiện email (kèm nút Đổi tài khoản). Tiếp theo ô "Thư mục trên Drive"
   kiểu hộp "Lưu thành…": "Lưu vào" (mặc định My Drive, nút Chọn… mở Google Picker) và ô "Thư mục mới bên trong" (không bắt buộc:
   gõ tên thì bấm Lưu máy chủ tạo thư mục đó rồi lưu vào đó, vì Picker không tạo được thư mục); dòng "Sẽ lưu vào" cho thấy trước kết quả.
   Chưa kết nối thì không lưu được; đổi tài khoản thì chỗ lưu về My Drive. Đang sửa thì có nút "Bỏ nơi lưu" (hỏi lại ở hộp khác). */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  BACKUP_MESSAGES,
  BACKUP_TARGET_KINDS,
  BACKUP_TARGET_KIND_LABEL,
  BackupTargetInputSchema,
  DRIVE_ROOT_FOLDER_ID,
  DRIVE_ROOT_FOLDER_NAME,
  type BackupTarget,
  type BackupTargetInput,
  type BackupTargetKind,
} from '@ulaw/shared';
import { useConnectGoogleDrive, useDrivePicker, useSaveBackupTarget, type DriveConnection } from '../../api/backups';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../features/auth/useAuth';
import { SHOW_DEMO } from '../../lib/env';
import { pickDriveFolder, type PickedDriveFolder } from '../../lib/googlePicker';
import styles from './BackupsPage.module.css';

/** Chỗ lưu mặc định trên Drive. */
const MY_DRIVE: PickedDriveFolder = { id: DRIVE_ROOT_FOLDER_ID, name: DRIVE_ROOT_FOLDER_NAME };

/** Nơi lưu mới: thư mục trên máy chủ, giữ 14 bản. */
const NEW_TARGET: BackupTargetInput = { name: '', kind: 'serverFolder', folder: '', keepLatest: 14 };

/** Chữ theo kiểu nơi lưu: dòng giải thích ở thẻ kiểu, gợi ý ô tên. */
const KIND_TEXT: Record<BackupTargetKind, { hint: string; namePlaceholder: string }> = {
  serverFolder: {
    hint: 'Lưu trên ổ đĩa của máy chủ',
    namePlaceholder: 'vd Ổ máy chủ · hằng ngày',
  },
  googleDrive: {
    hint: 'Lưu lên Drive của một tài khoản Google',
    namePlaceholder: 'vd Drive phòng',
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
    defaultValues: target
      ? { name: target.name, kind: target.kind, folder: target.folder, keepLatest: target.keepLatest, driveFolderId: target.driveFolderId ?? DRIVE_ROOT_FOLDER_ID }
      : { ...NEW_TARGET, driveFolderId: DRIVE_ROOT_FOLDER_ID },
  });
  const kind = watch('kind');
  const kindText = KIND_TEXT[kind];

  // Tài khoản Google: vừa kết nối trong hộp này, hoặc tài khoản cũ của nơi Drive đang sửa
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const driveAccount = connection?.email ?? (target?.kind === 'googleDrive' ? target.googleAccount : null);

  // Chỗ lưu trên Drive: nơi Drive đang sửa thì thư mục đang dùng, không thì My Drive (ô folder dùng chung với thư mục máy chủ nên giữ riêng tên)
  const [driveLocation, setDriveLocation] = useState<PickedDriveFolder>(
    target?.kind === 'googleDrive' && target.driveFolderId ? { id: target.driveFolderId, name: target.folder } : MY_DRIVE,
  );

  /**
   * Đổi chỗ lưu: nhớ id để gửi kèm khi Lưu.
   * @param location  My Drive hoặc thư mục vừa chọn
   */
  const changeDriveLocation = (location: PickedDriveFolder) => {
    setDriveLocation(location);
    setValue('driveFolderId', location.id);
    clearErrors('driveFolderId');
  };

  /**
   * Kết nối xong: nhớ driveGrantId để gửi kèm khi Lưu; thư mục của tài khoản cũ không dùng được nữa, chỗ lưu về My Drive.
   * @param connected  tài khoản vừa kết nối
   */
  const onConnected = (connected: DriveConnection) => {
    setConnection(connected);
    setValue('driveGrantId', connected.driveGrantId);
    clearErrors('driveGrantId');
    changeDriveLocation(MY_DRIVE);
  };

  // Picker mở theo tài khoản vừa kết nối, không thì tài khoản của nơi Drive đang sửa
  const pickerAccount = connection ? { driveGrantId: connection.driveGrantId } : target?.kind === 'googleDrive' && driveAccount ? { targetId: target.id } : null;
  const newDriveFolderName = watch('newDriveFolderName') ?? '';

  // Lưu: Drive phải có tài khoản; trùng thư mục (409) báo dưới ô thư mục; kết nối hết hạn thì bỏ để kết nối lại
  const onSubmit = handleSubmit(async (input) => {
    if (input.kind === 'googleDrive' && !driveAccount) {
      setError('driveGrantId', { message: BACKUP_MESSAGES.driveConnectFirst });
      return;
    }
    try {
      // Drive: gửi tên chỗ lưu; thư mục máy chủ: bỏ các ô của Drive
      const targetInput =
        input.kind === 'googleDrive'
          ? { ...input, folder: driveLocation.name }
          : { ...input, driveGrantId: undefined, driveFolderId: undefined, newDriveFolderName: undefined };
      await saveTarget.mutateAsync({ input: targetInput, targetId: target?.id });
      toast(target ? BACKUP_MESSAGES.targetSaved : BACKUP_MESSAGES.targetAdded, 'success');
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : BACKUP_MESSAGES[422];
      if (error instanceof ApiError && error.status === 409) setError(input.kind === 'googleDrive' ? 'driveFolderId' : 'folder', { message });
      else if (message === BACKUP_MESSAGES.driveFolderInvalid) setError('driveFolderId', { message });
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

      {kind === 'serverFolder' ? (
        <Field label="Thư mục trên máy chủ" required hint="Chữ không dấu, số, - và _, các cấp cách nhau bằng /." error={errors.folder?.message}>
          <span className={styles.prefixInput}>
            <span aria-hidden="true">backups/</span>
            <input {...register('folder')} placeholder="hang-ngay" aria-invalid={!!errors.folder} />
          </span>
        </Field>
      ) : (
        <>
          <DriveAccountField account={driveAccount} error={errors.driveGrantId?.message} onConnected={onConnected} />
          <DriveFolderField
            location={driveLocation}
            pickerAccount={pickerAccount}
            newFolderName={newDriveFolderName.trim()}
            newFolderInput={<input {...register('newDriveFolderName')} placeholder="vd Sao lưu cổng" maxLength={100} aria-invalid={!!errors.newDriveFolderName} />}
            error={errors.driveFolderId?.message ?? errors.newDriveFolderName?.message}
            onLocationChange={changeDriveLocation}
          />
        </>
      )}

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

/**
 * Ô "Thư mục trên Drive" của nơi lưu Drive, kiểu hộp "Lưu thành…":
 * "Lưu vào" (chỗ lưu, mặc định My Drive; nút Chọn… xin máy chủ token rồi mở Google Picker; về My Drive bằng một nút) và ô "Thư mục mới bên trong"
 * (không bắt buộc, Picker không tạo được thư mục nên gõ tên ở đây, bấm Lưu thì máy chủ tạo). Dòng "Sẽ lưu vào" cho thấy trước kết quả.
 * Tài khoản kết nối bằng bản giả (máy chủ trả 'demo') thì Chọn… hiện ô gõ tên thư mục (JUST FOR DEMO).
 * @param location          chỗ lưu đang chọn
 * @param pickerAccount     tài khoản (vừa kết nối, hoặc của nơi lưu đang sửa); null = chưa kết nối (nút Chọn… khóa)
 * @param newFolderName     tên thư mục mới đang gõ (đã cắt khoảng trắng), để hiện dòng "Sẽ lưu vào"
 * @param newFolderInput    ô nhập tên thư mục mới (đã gắn vào form)
 * @param error             câu báo dưới ô (không mở được thư mục, trùng nơi lưu khác, tên dài quá)
 * @param onLocationChange  gọi khi đổi chỗ lưu
 * @returns                 ô thư mục
 */
function DriveFolderField({
  location,
  pickerAccount,
  newFolderName,
  newFolderInput,
  error,
  onLocationChange,
}: {
  location: PickedDriveFolder;
  pickerAccount: { driveGrantId: string } | { targetId: string } | null;
  newFolderName: string;
  newFolderInput: ReactNode;
  error?: string;
  onLocationChange: (location: PickedDriveFolder) => void;
}) {
  const toast = useToast();
  const drivePicker = useDrivePicker();
  const [opening, setOpening] = useState(false);
  const [typingDemoName, setTypingDemoName] = useState(false);
  const [demoFolderName, setDemoFolderName] = useState('');

  /** Bấm Chọn…: xin token, mở Picker; tài khoản giả thì mở ô gõ tên. */
  const choose = async () => {
    if (!pickerAccount) return;
    setOpening(true);
    try {
      const session = await drivePicker.mutateAsync(pickerAccount);
      /* JUST FOR DEMO: START · tài khoản kết nối bằng bản giả dev-google-drive-connect: không có Picker thật, gõ tên thư mục.
         Bản thật: máy chủ luôn trả 'picker' */
      if (session.kind === 'demo') {
        setTypingDemoName(true);
        return;
      }
      /* JUST FOR DEMO: END */
      const pickedFolder = await pickDriveFolder(session).catch(() => {
        throw new Error(BACKUP_MESSAGES.pickerLoadFailed);
      });
      if (pickedFolder) onLocationChange(pickedFolder);
    } catch (pickerError) {
      toast(pickerError instanceof Error ? pickerError.message : BACKUP_MESSAGES[422], 'error');
    } finally {
      setOpening(false);
    }
  };

  const isMyDrive = location.id === DRIVE_ROOT_FOLDER_ID;
  return (
    <div className={styles.fieldLabel}>
      <span>
        Thư mục trên Drive <span className={styles.requiredMark}>*</span>
      </span>
      {typingDemoName ? (
        /* JUST FOR DEMO: START · khung giả lập Google Picker, chỉ hiện khi tài khoản kết nối bằng bản giả.
           Bản thật: cửa sổ Picker của Google, chọn xong báo tên, id thư mục về đây */
        <div className={styles.demoGoogle}>
          <strong>Chọn thư mục trên Drive (giả lập)</strong>
          <span className={styles.fieldHint}>Tài khoản này kết nối bằng bản giả nên không mở được Drive thật. Gõ tên thư mục bất kì để thử.</span>
          <input value={demoFolderName} onChange={(event) => setDemoFolderName(event.target.value)} aria-label="Tên thư mục trên Drive" />
          <div className={styles.dialogButtons}>
            <Button variant="ghost" onClick={() => setTypingDemoName(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              disabled={!demoFolderName.trim()}
              onClick={() => {
                onLocationChange({ id: `demo-${crypto.randomUUID()}`, name: demoFolderName.trim() });
                setTypingDemoName(false);
              }}
            >
              Chọn
            </Button>
          </div>
        </div>
      ) : (
        /* JUST FOR DEMO: END */ <div className={styles.saveAs}>
          <div className={styles.saveAsRow}>
            <span className={styles.saveAsLocation}>
              <span className={styles.fieldHint}>Lưu vào</span>
              <strong>📁 {location.name}</strong>
            </span>
            <span className={styles.folderActions}>
              {!isMyDrive && (
                <button type="button" className={styles.linkButton} onClick={() => onLocationChange(MY_DRIVE)} disabled={opening}>
                  Về My Drive
                </button>
              )}
              <Button onClick={() => void choose()} disabled={opening || !pickerAccount}>
                {opening ? 'Đang mở…' : 'Chọn…'}
              </Button>
            </span>
          </div>
          <label className={styles.fieldLabel}>
            <span>
              Thư mục mới bên trong <span className={styles.fieldHint}>(không bắt buộc)</span>
            </span>
            {newFolderInput}
          </label>
        </div>
      )}
      {!typingDemoName && (
        <span className={styles.fieldHint}>
          {pickerAccount
            ? `Sẽ lưu vào: ${location.name}${newFolderName ? ` / ${newFolderName} (tạo mới khi bấm Lưu)` : ''}`
            : 'Kết nối tài khoản Google trước rồi chọn chỗ lưu.'}
        </span>
      )}
      {error && (
        <span className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
