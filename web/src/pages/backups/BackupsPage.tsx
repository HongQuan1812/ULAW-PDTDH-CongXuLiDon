/* Trang Sao lưu (#/cau-hinh/sao-luu, vai trò có quyền manageBackups: Admin). Mỗi bản sao lưu gồm cả database lẫn tệp tải lên.
   Đầu trang: tên trang, nút "Sao lưu ngay…" (popup chọn nhiều nơi lưu, hoặc chỉ tải về máy này).
   Thanh trạng thái: lần thành công gần nhất, lần định kì tới; nhãn "Đang sao lưu…" chỉ hiện khi có bản đang chạy.
   Lịch sử (tìm, lọc, sắp xếp, phân trang) bên trái; khung "Lịch và nơi lưu" (lịch định kì, nơi lưu) bên phải, giống khung Thông tin đơn
   ở trang chi tiết đơn: rộng thì nằm bên phải (bấm › để ẩn), hẹp (≤ 1100px) thì ẩn sẵn, bấm nút ở đầu trang để trượt ra từ bên phải.
   Đang có bản chạy thì trang tự tải lại tới khi xong, xong thì tải lại lịch sử. Khôi phục: chưa làm. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BACKUP_MESSAGES, type BackupTarget, type BackupsResponse } from '@ulaw/shared';
import { BACKUP_RUNS_KEY, useBackups, useDownloadBackup, useRunBackup } from '../../api/backups';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { formatDateTime } from '../../lib/format';
import { saveToDevice } from '../../lib/saveToDevice';
import { FormInfoPanel, FormInfoPanelToggle, useFormInfoPanel } from '../form/FormInfoPanel';
import { BackToSettings } from '../settings/BackToSettings';
import profileStyles from '../profile/ProfilePage.module.css';
import { BackupHistoryCard } from './BackupHistoryCard';
import { BackupScheduleCard } from './BackupScheduleCard';
import { BackupTargetsCard, errorText } from './BackupTargetsCard';
import { RunBackupDialog } from './RunBackupDialog';
import styles from './BackupsPage.module.css';

/** Tên khung bên phải và nút hiện khung. */
const SIDE_PANEL_TITLE = 'Lịch và nơi lưu';

/** Khóa localStorage nhớ việc đã ẩn khung bên phải ở màn hình rộng. */
const SIDE_PANEL_STORAGE_KEY = 'backupsPanel.hiddenOnWideScreen';

/**
 * Trang Sao lưu.
 * @returns  giao diện trang; đang tải thì câu chờ; lỗi thì câu báo lỗi kèm nút ↻
 */
export function BackupsPage() {
  const backupsQuery = useBackups();
  const loadError = loadErrorMessage(backupsQuery);
  useRefreshHistoryWhenDone(backupsQuery.data?.running ?? false);

  return (
    <div className={profileStyles.page}>
      <BackToSettings />
      {backupsQuery.isPending ? (
        <>
          <PageTitle />
          <p className={profileStyles.muted}>Đang tải…</p>
        </>
      ) : loadError || !backupsQuery.data ? (
        <>
          <PageTitle />
          <section className={`${profileStyles.card} ${profileStyles.errorCard}`}>
            <LoadError message={loadError ?? 'Không tải được trang sao lưu.'} />
            <RefreshButton query={backupsQuery} label="Sao lưu" />
          </section>
        </>
      ) : (
        <BackupsContent overview={backupsQuery.data} />
      )}
    </div>
  );
}

/**
 * Tên trang và dòng giải thích.
 * @param children  tùy chọn: nút bên phải (Sao lưu ngay…)
 * @returns         đầu trang
 */
function PageTitle({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.head}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Sao lưu</h1>
        <p className={styles.subtitle}>Mỗi bản gồm cả database lẫn tệp người dùng tải lên.</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Nội dung trang khi đã có tổng quan: đầu trang, thanh trạng thái, hai cột, popup Sao lưu ngay.
 * Trang giữ việc sao lưu / tải về (không phải popup), để popup đóng rồi nút đầu trang vẫn báo "Đang tạo bản để tải về…".
 * @param overview  tổng quan
 * @returns         nội dung trang
 */
function BackupsContent({ overview }: { overview: BackupsResponse }) {
  const toast = useToast();
  const runBackup = useRunBackup();
  const downloadBackup = useDownloadBackup();
  const [runOpen, setRunOpen] = useState(false);
  // Hộp thêm / sửa nơi lưu: undefined = đóng, null = thêm mới, nơi lưu = sửa nơi đó
  const [editingTarget, setEditingTarget] = useState<BackupTarget | null | undefined>(undefined);
  const sidePanel = useFormInfoPanel(SIDE_PANEL_STORAGE_KEY);
  const busy = overview.running || runBackup.isPending || downloadBackup.isPending;

  /**
   * Sao lưu vào các nơi đã chọn (chạy nền).
   * @param targetIds  id các nơi lưu
   * @returns          true khi máy chủ đã nhận
   */
  const run = async (targetIds: string[]): Promise<boolean> => {
    try {
      await runBackup.mutateAsync(targetIds);
      toast(BACKUP_MESSAGES.started(targetIds.length), 'info');
      return true;
    } catch (error) {
      toast(errorText(error), 'error');
      return false;
    }
  };

  /** Đóng popup, tạo bản rồi tải về máy. */
  const download = async () => {
    setRunOpen(false);
    try {
      const archive = await downloadBackup.mutateAsync();
      saveToDevice(archive.content, archive.fileName);
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  const runButtonLabel = downloadBackup.isPending ? 'Đang tạo bản để tải về…' : overview.running || runBackup.isPending ? 'Đang sao lưu…' : 'Sao lưu ngay…';

  return (
    <>
      <PageTitle>
        <div className={styles.headActions}>
          <FormInfoPanelToggle panel={sidePanel} label={SIDE_PANEL_TITLE} />
          <Button variant="primary" onClick={() => setRunOpen(true)} disabled={busy}>
            {runButtonLabel}
          </Button>
        </div>
      </PageTitle>

      <StatusBar overview={overview} />

      <div className={`${styles.columns} ${!sidePanel.isNarrow && sidePanel.isOpen ? styles.withSide : ''}`}>
        <BackupHistoryCard />
        <FormInfoPanel panel={sidePanel} title={SIDE_PANEL_TITLE}>
          <BackupScheduleCard overview={overview} />
          <BackupTargetsCard overview={overview} editing={editingTarget} onEdit={setEditingTarget} />
        </FormInfoPanel>
      </div>

      <RunBackupDialog
        open={runOpen}
        overview={overview}
        onClose={() => setRunOpen(false)}
        onRun={run}
        onDownload={() => void download()}
        onAddTarget={() => {
          setRunOpen(false);
          setEditingTarget(null);
        }}
      />
    </>
  );
}

/**
 * Thanh trạng thái: lần thành công gần nhất (chấm xanh khi đã có), lần định kì tới, nhãn "Đang sao lưu…" khi có bản đang chạy.
 * @param overview  tổng quan
 * @returns         thanh
 */
function StatusBar({ overview }: { overview: BackupsResponse }) {
  return (
    <section className={styles.statusBar} aria-label="Tình trạng sao lưu" aria-live="polite">
      <div className={styles.statusItem}>
        <span className={`${styles.dot} ${overview.lastSuccessAt ? styles.dotOk : ''}`} aria-hidden="true" />
        <span>Gần nhất</span>
        <strong>{overview.lastSuccessAt ? formatDateTime(overview.lastSuccessAt) : 'Chưa có'}</strong>
      </div>
      <span className={styles.statusDivider} aria-hidden="true" />
      <div className={styles.statusItem}>
        <span>Lần tới</span>
        <strong>{overview.nextScheduledAt ? formatDateTime(overview.nextScheduledAt) : 'Lịch đang tắt'}</strong>
      </div>
      {overview.running && (
        <>
          <span className={styles.statusDivider} aria-hidden="true" />
          <span className={`${styles.pill} ${styles.pill_running}`}>
            <i aria-hidden="true" />
            Đang sao lưu…
          </span>
        </>
      )}
    </section>
  );
}

/**
 * Bản sao lưu vừa chạy xong (running đổi từ true sang false): tải lại lịch sử để dòng "Đang chạy" thành kết quả.
 * @param running  tổng quan đang báo có bản chạy
 */
function useRefreshHistoryWhenDone(running: boolean) {
  const queryClient = useQueryClient();
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running) void queryClient.invalidateQueries({ queryKey: BACKUP_RUNS_KEY });
    wasRunning.current = running;
  }, [running, queryClient]);
}
