/* Trang Sao lưu (#/sao-luu, vai trò có quyền manageBackups: Admin).
   Mỗi bản sao lưu gồm cả database lẫn tệp tải lên. Trên đầu: lần thành công gần nhất, lần định kì tới, đang chạy không.
   Rồi: sao lưu ngay (chọn nơi lưu hoặc tải về máy) · các nơi lưu (thêm, sửa, bỏ, kết nối Google Drive) · lịch định kì · lịch sử.
   Đang có bản chạy thì trang tự tải lại tới khi xong. Khôi phục: chưa làm. */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  BACKUP_MESSAGES,
  BACKUP_TARGET_KIND_LABEL,
  DRIVE_ERROR_PARAM,
  formatFileSize,
  type BackupRun,
  type BackupTarget,
  type BackupsResponse,
} from '@ulaw/shared';
import {
  fetchBackupFile,
  useBackups,
  useConnectGoogleDrive,
  useDownloadBackup,
  useRemoveBackupTarget,
  useRunBackup,
} from '../../api/backups';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { Modal } from '../../components/Modal';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { formatDateTime } from '../../lib/format';
import { saveToDevice } from '../../lib/saveToDevice';
import profileStyles from '../profile/ProfilePage.module.css';
import { BackupScheduleCard } from './BackupScheduleCard';
import { BackupTargetDialog } from './BackupTargetDialog';
import styles from './BackupsPage.module.css';

/** Giá trị ô "Lưu vào" khi chọn tải về máy. */
const DOWNLOAD_CHOICE = 'download';

/**
 * Câu báo lỗi của một lệnh.
 * @param error  lỗi bắt được
 * @returns      câu báo của máy chủ, hoặc câu chung
 */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : BACKUP_MESSAGES[422];
}

/**
 * Trang Sao lưu.
 * @returns  giao diện trang; đang tải thì câu chờ; lỗi thì câu báo lỗi kèm nút ↻
 */
export function BackupsPage() {
  const backupsQuery = useBackups();
  const loadError = loadErrorMessage(backupsQuery);
  useDriveErrorToast();

  return (
    <div className={profileStyles.page}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Sao lưu</h1>
        <p className={styles.subtitle}>Mỗi bản sao lưu gồm cả database lẫn tệp người dùng tải lên.</p>
      </div>

      {backupsQuery.isPending ? (
        <p className={profileStyles.muted}>Đang tải…</p>
      ) : loadError || !backupsQuery.data ? (
        <section className={`${profileStyles.card} ${profileStyles.errorCard}`}>
          <LoadError message={loadError ?? 'Không tải được trang sao lưu.'} />
          <RefreshButton query={backupsQuery} label="Sao lưu" />
        </section>
      ) : (
        <>
          <SummaryCard overview={backupsQuery.data} />
          <RunNowCard overview={backupsQuery.data} />
          <TargetsCard overview={backupsQuery.data} />
          <BackupScheduleCard overview={backupsQuery.data} />
          <HistoryCard overview={backupsQuery.data} backupsQuery={backupsQuery} />
        </>
      )}
    </div>
  );
}

/** Kết nối Google Drive lỗi thì máy chủ chuyển về trang kèm ?driveError=…: hiện câu báo một lần rồi bỏ tham số. */
function useDriveErrorToast() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const driveError = searchParams.get(DRIVE_ERROR_PARAM);
  useEffect(() => {
    if (!driveError) return;
    toast(driveError === 'denied' ? BACKUP_MESSAGES.driveError.denied : BACKUP_MESSAGES.driveError.failed, 'error');
    setSearchParams({}, { replace: true });
  }, [driveError, setSearchParams, toast]);
}

/**
 * Thẻ tóm tắt: lần thành công gần nhất, lần định kì tới, đang chạy không.
 * @param overview  tổng quan
 * @returns         thẻ
 */
function SummaryCard({ overview }: { overview: BackupsResponse }) {
  const items = [
    { label: 'Sao lưu thành công gần nhất', text: overview.lastSuccessAt ? formatDateTime(overview.lastSuccessAt) : 'Chưa có' },
    { label: 'Lần định kì tới', text: overview.nextScheduledAt ? formatDateTime(overview.nextScheduledAt) : 'Lịch đang tắt' },
  ];
  return (
    <section className={`${profileStyles.card} ${styles.summary}`} aria-label="Tóm tắt sao lưu">
      {items.map((item) => (
        <div key={item.label} className={styles.summaryItem}>
          <span>{item.label}</span>
          <strong>{item.text}</strong>
        </div>
      ))}
      <div className={styles.summaryItem} aria-live="polite">
        <span>Tình trạng</span>
        {overview.running ? (
          <span className={styles.runningPill}>
            <i aria-hidden="true" />
            Đang sao lưu…
          </span>
        ) : (
          <strong>Không có bản nào đang chạy</strong>
        )}
      </div>
    </section>
  );
}

/**
 * Thẻ Sao lưu ngay: chọn nơi lưu (hoặc tải về máy) rồi bấm.
 * @param overview  tổng quan
 * @returns         thẻ
 */
function RunNowCard({ overview }: { overview: BackupsResponse }) {
  const toast = useToast();
  const runBackup = useRunBackup();
  const downloadBackup = useDownloadBackup();
  const [choice, setChoice] = useState(overview.targets[0]?.id ?? DOWNLOAD_CHOICE);
  const busy = overview.running || runBackup.isPending || downloadBackup.isPending;

  // Nơi lưu đang chọn bị bỏ thì về lựa chọn đầu
  const chosen = choice === DOWNLOAD_CHOICE || overview.targets.some((target) => target.id === choice) ? choice : (overview.targets[0]?.id ?? DOWNLOAD_CHOICE);

  /** Bắt đầu sao lưu: vào nơi lưu thì chạy nền; tải về thì chờ tệp rồi lưu về máy. */
  const start = async () => {
    try {
      if (chosen === DOWNLOAD_CHOICE) {
        const archive = await downloadBackup.mutateAsync();
        saveToDevice(archive.content, archive.fileName);
        return;
      }
      await runBackup.mutateAsync(chosen);
      toast(BACKUP_MESSAGES.started(overview.targets.find((target) => target.id === chosen)?.name ?? ''), 'info');
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  return (
    <section className={profileStyles.card} aria-labelledby="run-now-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleBlock}>
          <h2 id="run-now-title">Sao lưu ngay</h2>
          <p className={styles.cardDescription}>Tạo một bản sao lưu ngay bây giờ. Mỗi lúc chỉ chạy một bản.</p>
        </div>
      </div>
      <div className={styles.runNow}>
        <label className={styles.inlineField}>
          <span>Lưu vào</span>
          <select value={chosen} onChange={(event) => setChoice(event.target.value)} disabled={busy}>
            {overview.targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} ({BACKUP_TARGET_KIND_LABEL[target.kind]})
              </option>
            ))}
            <option value={DOWNLOAD_CHOICE}>Tải về máy này</option>
          </select>
        </label>
        <Button variant="primary" onClick={() => void start()} disabled={busy}>
          {downloadBackup.isPending ? 'Đang tạo bản để tải về…' : overview.running ? 'Đang sao lưu…' : 'Sao lưu ngay'}
        </Button>
      </div>
    </section>
  );
}

/**
 * Thẻ Nơi lưu: mỗi nơi một dòng (tên, kiểu, thư mục, giữ bao nhiêu bản, đang có bao nhiêu bản), nút sửa, bỏ, kết nối Drive.
 * @param overview  tổng quan
 * @returns         thẻ
 */
function TargetsCard({ overview }: { overview: BackupsResponse }) {
  const toast = useToast();
  const removeTarget = useRemoveBackupTarget();
  const connectDrive = useConnectGoogleDrive();
  // Hộp sửa: undefined = đóng, null = thêm mới, nơi lưu = sửa nơi đó
  const [editing, setEditing] = useState<BackupTarget | null | undefined>(undefined);
  const [removing, setRemoving] = useState<BackupTarget | null>(null);

  /** Sang Google để kết nối Drive cho một nơi lưu. */
  const connect = async (target: BackupTarget) => {
    try {
      const { url } = await connectDrive.mutateAsync(target.id);
      window.location.assign(url);
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

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
    <section className={profileStyles.card} aria-labelledby="targets-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleBlock}>
          <h2 id="targets-title">Nơi lưu</h2>
          <p className={styles.cardDescription}>
            Thư mục trên máy chủ hoặc Google Drive. Mỗi nơi giữ một số bản gần nhất, bản cũ hơn tự xóa.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>+ Thêm nơi lưu</Button>
      </div>

      {overview.targets.length === 0 ? (
        <p className={profileStyles.muted}>Chưa có nơi lưu nào. Vẫn tải bản sao lưu về máy được.</p>
      ) : (
        <ul className={styles.targetList}>
          {overview.targets.map((target) => (
            <li key={target.id} className={styles.target}>
              <div className={styles.targetInfo}>
                <strong>{target.name}</strong>
                <span className={styles.targetMeta}>
                  {BACKUP_TARGET_KIND_LABEL[target.kind]} · {target.kind === 'googleDrive' ? 'thư mục' : 'thư mục con'} “{target.folder}” · giữ{' '}
                  {target.keepLatest} bản · đang có {target.backupCount} bản
                </span>
                {target.kind === 'googleDrive' &&
                  (target.googleAccount ? (
                    <span className={styles.targetMeta}>Tài khoản Google: {target.googleAccount}</span>
                  ) : (
                    <span className={styles.warning}>Chưa kết nối tài khoản Google, chưa lưu vào đây được.</span>
                  ))}
              </div>
              <div className={styles.targetActions}>
                {target.kind === 'googleDrive' && (
                  <Button onClick={() => void connect(target)} disabled={!overview.googleDriveAvailable || connectDrive.isPending}>
                    {target.googleAccount ? 'Đổi tài khoản Google' : 'Kết nối Google Drive'}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setEditing(target)}>
                  Sửa
                </Button>
                <Button variant="danger" onClick={() => setRemoving(target)}>
                  Bỏ
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!overview.googleDriveAvailable && <p className={styles.warning}>{BACKUP_MESSAGES.driveUnavailable}</p>}

      <BackupTargetDialog open={editing !== undefined} target={editing ?? null} onClose={() => setEditing(undefined)} />

      <Modal open={removing !== null} onClose={() => setRemoving(null)} title={`Bỏ nơi lưu “${removing?.name ?? ''}”?`}>
        <p className={styles.dialogText}>
          Lịch định kì sẽ không lưu vào đây nữa. Các bản đã lưu ở đó không bị xóa, lịch sử vẫn giữ nguyên.
        </p>
        <div className={styles.dialogButtons}>
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            Hủy
          </Button>
          <Button variant="danger" onClick={() => void confirmRemove()} disabled={removeTarget.isPending}>
            Bỏ nơi lưu
          </Button>
        </div>
      </Modal>
    </section>
  );
}

/**
 * Chữ ở cột Tình trạng của một lần sao lưu.
 * @param run  lần sao lưu
 * @returns    nhãn và kiểu màu
 */
function runStatusOf(run: BackupRun): { text: string; className: string } {
  if (run.status === 'running') return { text: 'Đang chạy', className: styles.statusRunning! };
  if (run.status === 'error') return { text: 'Lỗi', className: styles.statusError! };
  return { text: run.pruned ? 'Thành công · đã xóa (quá số bản giữ lại)' : 'Thành công', className: styles.statusOk! };
}

/**
 * Thẻ Lịch sử: mỗi lần sao lưu một dòng; bản còn ở thư mục máy chủ có nút tải về.
 * @param overview      tổng quan
 * @param backupsQuery  kết quả useBackups, cho nút ↻
 * @returns             thẻ
 */
function HistoryCard({ overview, backupsQuery }: { overview: BackupsResponse; backupsQuery: ReturnType<typeof useBackups> }) {
  const toast = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /** Tải về một bản đã lưu. */
  const download = async (run: BackupRun) => {
    setDownloadingId(run.id);
    try {
      const archive = await fetchBackupFile(run.id);
      saveToDevice(archive.content, archive.fileName);
    } catch (error) {
      toast(errorText(error), 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section className={profileStyles.card} aria-labelledby="history-title">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleBlock}>
          <h2 id="history-title">Lịch sử</h2>
          <p className={styles.cardDescription}>Các lần sao lưu gần nhất, mới nhất trước.</p>
        </div>
        <RefreshButton query={backupsQuery} label="lịch sử sao lưu" size="small" />
      </div>

      {overview.runs.length === 0 ? (
        <p className={profileStyles.muted}>Chưa có lần sao lưu nào.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.history}>
            <thead>
              <tr>
                <th>Bắt đầu</th>
                <th>Lưu vào</th>
                <th>Chạy</th>
                <th>Dung lượng</th>
                <th>Tình trạng</th>
                <th aria-label="Tải về" />
              </tr>
            </thead>
            <tbody>
              {overview.runs.map((run) => {
                const status = runStatusOf(run);
                return (
                  <tr key={run.id}>
                    <td className={styles.nowrap}>{formatDateTime(run.startedAt)}</td>
                    <td>
                      {run.targetName}
                      <small className={styles.cellSub}>{run.targetKind === 'download' ? 'Tải về máy' : BACKUP_TARGET_KIND_LABEL[run.targetKind]}</small>
                    </td>
                    <td>{run.trigger === 'scheduled' ? 'Định kì' : `Bấm tay · ${run.startedBy?.name ?? ''}`}</td>
                    <td className={styles.nowrap}>{run.sizeBytes === null ? '—' : formatFileSize(run.sizeBytes)}</td>
                    <td>
                      <span className={status.className}>{status.text}</span>
                      {run.error && <small className={styles.cellError}>{run.error}</small>}
                    </td>
                    <td>
                      {run.fileAvailable && (
                        <Button variant="ghost" onClick={() => void download(run)} disabled={downloadingId === run.id}>
                          {downloadingId === run.id ? 'Đang tải…' : 'Tải về'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
