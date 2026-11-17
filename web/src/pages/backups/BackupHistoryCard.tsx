/* Thẻ Lịch sử (cột trái trang Sao lưu): bảng phân trang ở máy chủ, tìm kiếm / Sắp xếp / Lọc dùng chung với các bảng khác,
   mặc định mới nhất trước, 10 dòng mỗi trang. Mỗi lần sao lưu vào một nơi là một dòng:
   lúc (dưới là cách chạy), lưu vào (dưới là kiểu nơi lưu), dung lượng, tình trạng (lỗi thì kèm câu lỗi), nút Tải về khi tệp còn trên máy chủ. */
import { useState } from 'react';
import { BACKUP_RUN_KIND_LABEL, BACKUP_RUN_LIST_FIELDS, BACKUP_RUN_STATUS_LABEL, backupRunStatusView, formatFileSize, type BackupRun } from '@ulaw/shared';
import { BACKUP_RUNS_SOURCE, fetchBackupFile } from '../../api/backups';
import { LoadError } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { HeaderCell } from '../../components/table/HeaderCell';
import { Highlight } from '../../components/table/Highlight';
import { Pager } from '../../components/table/Pager';
import { TableToolbar } from '../../components/table/TableToolbar';
import { displayText, type TableField } from '../../components/table/tableTools';
import { useServerTable } from '../../components/table/useServerTable';
import { EMPTY_TEXT, formatDateTime } from '../../lib/format';
import { saveToDevice } from '../../lib/saveToDevice';
import tableStyles from '../../components/table/table.module.css';
import profileStyles from '../profile/ProfilePage.module.css';
import { errorText } from './BackupTargetsCard';
import styles from './BackupsPage.module.css';

/** Số dòng mỗi trang. */
const PAGE_SIZE = 10;

/** Tên bảng, để nhớ cách xem khi đi qua trang khác rồi quay lại. */
const TABLE_ID = 'backups.runs';

/**
 * Cột của bảng theo tên.
 * @param key  tên cột trong BACKUP_RUN_LIST_FIELDS
 * @returns    cột
 */
function fieldOf(key: string): TableField<BackupRun> {
  return BACKUP_RUN_LIST_FIELDS.find((field) => field.key === key)!;
}

/** Các cột hiện thành cột bảng; cách chạy, kiểu nơi lưu hiện thành dòng phụ (vẫn tìm, lọc, sắp xếp được). Dung lượng ghi gọn tên cột. */
const COLUMNS: TableField<BackupRun>[] = [fieldOf('startedAt'), fieldOf('targetName'), { ...fieldOf('sizeMB'), label: 'Dung lượng' }, fieldOf('status')];

/** Số cột của bảng: các cột dữ liệu và cột nút Tải về. */
const COLUMN_COUNT = COLUMNS.length + 1;

/**
 * Thẻ Lịch sử.
 * @returns  thẻ: tiêu đề, nút ↻, thanh công cụ, bảng, thanh trang
 */
export function BackupHistoryCard() {
  const toast = useToast();
  const runsTable = useServerTable({ tableId: TABLE_ID, source: BACKUP_RUNS_SOURCE, pageSize: PAGE_SIZE });
  const { searchText: query, sorting, filterRules, hasCriteria, isPageLoading, errorMessage } = runsTable;
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /**
   * Tải về một bản đã lưu ở thư mục trên máy chủ.
   * @param run  lần sao lưu
   */
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
    <section className={`${profileStyles.card} ${profileStyles.tableCard}`} aria-labelledby="history-title">
      <div className={profileStyles.sectionHead}>
        <div className={profileStyles.titleGroup}>
          <h2 id="history-title">Lịch sử</h2>
          <RefreshButton query={runsTable.pageQuery} label="lịch sử sao lưu" size="small" />
        </div>
      </div>

      <TableToolbar
        fields={BACKUP_RUN_LIST_FIELDS}
        filterOptions={runsTable.filterOptions}
        query={runsTable.query}
        onQueryChange={runsTable.setQuery}
        searchPlaceholder="Tìm theo nơi lưu, người bấm, tình trạng, câu lỗi"
        searchLabel="Tìm trong lịch sử sao lưu"
        sorting={sorting}
        onSortingChange={runsTable.setSorting}
        defaultSortNote="Bảng đang xếp mới nhất trước."
        filterRules={filterRules}
        onFilterRulesChange={runsTable.setFilterRules}
        defaultFilterKey="status"
      />

      {/* Đang chờ trang mới: trang cũ mờ đi, không bấm được, có vạch tải ở mép trên bảng */}
      <div className={`${tableStyles.tableWrap} ${isPageLoading ? tableStyles.pageLoading : ''}`}>
        <table className={`${tableStyles.table} ${styles.historyTable}`} aria-busy={isPageLoading}>
          <thead>
            <tr>
              {COLUMNS.map((field) => (
                <HeaderCell key={field.key} field={field} sorting={sorting} filterRules={filterRules} />
              ))}
              <th>
                <span className="sr-only">Tải về</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {runsTable.isFirstLoad ? (
              <MessageRow text="Đang tải lịch sử sao lưu…" />
            ) : errorMessage ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className={tableStyles.messageCell}>
                  <LoadError message={errorMessage} />
                </td>
              </tr>
            ) : runsTable.rows.length === 0 ? (
              <MessageRow text={hasCriteria ? 'Không có lần sao lưu nào khớp điều kiện tìm kiếm và bộ lọc.' : 'Chưa có lần sao lưu nào.'} />
            ) : (
              runsTable.rows.map((run) => (
                <tr key={run.id}>
                  <td>
                    <Highlight text={formatDateTime(run.startedAt)} query={query} />
                    <small className={styles.cellSub}>
                      <Highlight text={displayText(fieldOf('trigger'), run)} query={query} />
                    </small>
                  </td>
                  <td>
                    <span className={tableStyles.wrapText}>
                      <Highlight text={run.targetName} query={query} />
                    </span>
                    <small className={styles.cellSub}>
                      <Highlight text={BACKUP_RUN_KIND_LABEL[run.targetKind]} query={query} />
                    </small>
                  </td>
                  <td>{run.sizeBytes === null ? <span className={tableStyles.dash}>{EMPTY_TEXT}</span> : formatFileSize(run.sizeBytes)}</td>
                  <td>
                    <StatusPill run={run} query={query} />
                    {run.error && (
                      <small className={styles.cellError}>
                        <Highlight text={run.error} query={query} />
                      </small>
                    )}
                  </td>
                  <td className={tableStyles.goCell}>
                    {run.fileAvailable && (
                      <button type="button" className={styles.linkButton} onClick={() => void download(run)} disabled={downloadingId === run.id}>
                        {downloadingId === run.id ? 'Đang tải…' : 'Tải về'}
                      </button>
                    )}
                    {run.driveFileUrl && (
                      <a href={run.driveFileUrl} target="_blank" rel="noopener noreferrer" className={styles.linkButton} title="Mở tệp trên Google Drive">
                        Mở trên Drive
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager
        pageIndex={runsTable.pageIndex}
        pageCount={runsTable.pageCount}
        pageSize={PAGE_SIZE}
        total={runsTable.total}
        unit="lần sao lưu"
        onPageChange={runsTable.setPageIndex}
        loading={isPageLoading}
      />
    </section>
  );
}

/**
 * Nhãn tình trạng: Thành công xanh lá, Lỗi đỏ, Đang chạy xanh dương (chấm nhấp nháy), Đã xóa xám.
 * @param run    lần sao lưu
 * @param query  chữ đang tìm, để tô sáng
 * @returns      thẻ <span>
 */
function StatusPill({ run, query }: { run: BackupRun; query: string }) {
  const status = backupRunStatusView(run);
  return (
    <span className={`${styles.pill} ${styles[`pill_${status}`]}`}>
      {status === 'running' && <i aria-hidden="true" />}
      <Highlight text={BACKUP_RUN_STATUS_LABEL[status]} query={query} />
    </span>
  );
}

/**
 * Một dòng chữ chiếm cả bề ngang bảng: đang tải, hoặc không có dòng nào.
 * @param text  câu cần hiện
 * @returns     thẻ <tr>
 */
function MessageRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={COLUMN_COUNT} className={tableStyles.messageCell}>
        {text}
      </td>
    </tr>
  );
}
