/* Trang Nguồn dữ liệu (#/cau-hinh/nguon-du-lieu, vai trò có quyền manageDataSources: Admin).
   Các nguồn dữ liệu bên ngoài cổng đọc tới, chỉ xem. Trước mắt có database trường: cấu hình kết nối (không có mật khẩu),
   đang kết nối được không, mất bao lâu. Máy chủ thử kết nối mỗi lần tải, nút ↻ là kiểm tra lại. */
import { DATA_SOURCE_MESSAGES, type SchoolDatabaseStatus } from '@ulaw/shared';
import { useDataSources } from '../../api/data-sources';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { formatDateTime } from '../../lib/format';
import { BackToSettings } from '../settings/BackToSettings';
import profileStyles from '../profile/ProfilePage.module.css';
import styles from './DataSourcesPage.module.css';

/**
 * Trang Nguồn dữ liệu: tải tình trạng các nguồn rồi hiện từng thẻ.
 * @returns  giao diện trang; đang tải thì câu chờ; lỗi thì câu báo lỗi kèm nút ↻
 */
export function DataSourcesPage() {
  const dataSourcesQuery = useDataSources();
  const loadError = loadErrorMessage(dataSourcesQuery);

  return (
    <div className={profileStyles.page}>
      <BackToSettings />
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Nguồn dữ liệu</h1>
        <p className={styles.subtitle}>Dữ liệu bên ngoài cổng đọc tới. Cổng chỉ đọc, không ghi gì vào các nguồn này.</p>
      </div>

      {/* Chưa có dữ liệu: câu chờ, hoặc câu báo lỗi kèm nút tải lại */}
      {dataSourcesQuery.isPending ? (
        <p className={profileStyles.muted}>Đang kiểm tra kết nối…</p>
      ) : loadError || !dataSourcesQuery.data ? (
        <section className={`${profileStyles.card} ${profileStyles.errorCard}`}>
          <LoadError message={loadError ?? 'Không tải được nguồn dữ liệu.'} />
          <RefreshButton query={dataSourcesQuery} label="Nguồn dữ liệu" />
        </section>
      ) : (
        <SchoolDatabaseCard status={dataSourcesQuery.data.schoolDatabase} dataSourcesQuery={dataSourcesQuery} />
      )}
    </div>
  );
}

/**
 * Thẻ Database trường: nhãn kết nối và nút kiểm tra lại, lí do chưa kết nối được, cấu hình đang dùng.
 * @param status            cấu hình và kết quả thử kết nối
 * @param dataSourcesQuery  kết quả useDataSources, cho nút ↻ kiểm tra lại
 * @returns                 thẻ
 */
function SchoolDatabaseCard({ status, dataSourcesQuery }: { status: SchoolDatabaseStatus; dataSourcesQuery: ReturnType<typeof useDataSources> }) {
  const checking = dataSourcesQuery.isFetching;

  // Các dòng cấu hình; chưa cấu hình thì ghi "Chưa cấu hình"
  const rows: { label: string; text: string }[] = [
    { label: 'Máy chủ', text: status.host ? `${status.host}:${status.port}` : 'Chưa cấu hình' },
    { label: 'Database', text: status.database },
    { label: 'Tài khoản', text: status.user ?? 'Chưa cấu hình' },
    { label: 'Thời gian phản hồi', text: status.latencyMs === null ? '—' : `${status.latencyMs} ms` },
    { label: 'Kiểm tra lúc', text: formatDateTime(status.checkedAt) },
  ];

  return (
    <section className={`${profileStyles.card} ${styles.sourceCard}`} aria-labelledby="school-database-title">
      {/* Đầu thẻ: tên, mô tả bên trái; nhãn kết nối và nút ↻ kiểm tra lại bên phải */}
      <div className={styles.cardHead}>
        <div className={styles.cardTitleBlock}>
          <h2 id="school-database-title">Database trường</h2>
          <p className={styles.cardDescription}>SQL Server của trường. Trang hồ sơ lấy MSSV, lớp, ngành, khóa từ đây.</p>
        </div>
        <div className={styles.connection} aria-live="polite">
          {checking ? (
            <span className={styles.checking}>
              <i aria-hidden="true" />
              Đang kiểm tra…
            </span>
          ) : (
            <span className={status.connected ? styles.connected : styles.disconnected}>
              <i aria-hidden="true" />
              {status.connected ? 'Đang kết nối' : 'Chưa kết nối'}
            </span>
          )}
          <RefreshButton query={dataSourcesQuery} label="trạng thái database trường" size="small" />
        </div>
      </div>

      {/* Lí do chưa kết nối được; trang hồ sơ đang dùng bảng mẫu thay cho database trường */}
      {status.problem && <p className={styles.problem}>{DATA_SOURCE_MESSAGES.schoolDatabaseProblem[status.problem]}</p>}
      {status.usesSampleData && (
        <p className={styles.note}>Trang hồ sơ đang dùng dữ liệu mẫu (bản giả), chưa đọc thông tin sinh viên từ database trường.</p>
      )}

      <dl className={styles.details}>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
