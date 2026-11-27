/* Ba khung thống kê đầu trang Quản lí đơn:
   "Theo trạng thái" (tổng, thanh tỉ lệ nhiều màu, 6 ô), "Theo loại đơn" (vành khuyên, FormTypeDonut)
   và "Theo tình trạng hạn" (vành khuyên, DeadlineDonut; nằm dưới khung trạng thái, chỉ đếm đơn có hạn).
   Số liệu đếm trên TẤT CẢ đơn, không đổi theo ô tìm kiếm / bộ lọc của bảng.
   Bấm một ô trạng thái, một loại đơn hoặc một ô tình trạng hạn thì lọc bảng bên dưới; bấm lại để bỏ lọc. */
import {
  FORM_STATUSES,
  FORM_STATUS_LABEL,
  type DeadlineState,
  type FormStats,
  type FormStatus,
} from '@ulaw/shared';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import type { UseQueryResult } from '@tanstack/react-query';
import styles from './FormStatsPanel.module.css';
import { DeadlineDonut } from './DeadlineDonut';
import { FormTypeDonut } from './FormTypeDonut';

interface FormStatsPanelProps {
  /** Kết quả useFormStats() */
  statsQuery: UseQueryResult<FormStats>;
  /** Trạng thái đang lọc ở bảng (null = không lọc) */
  activeStatus: string | null;
  /** Loại đơn đang lọc ở bảng (null = không lọc) */
  activeFormTypeId: string | null;
  /** Tình trạng hạn đang lọc ở bảng (null = không lọc) */
  activeDeadlineState: string | null;
  /** Bấm ô trạng thái */
  onToggleStatus: (status: FormStatus) => void;
  /** Bấm một loại đơn (lát hoặc dòng chú thích) */
  onToggleFormType: (formTypeId: string) => void;
  /** Bấm ô tình trạng hạn */
  onToggleDeadlineState: (state: DeadlineState) => void;
}

/** Một ô đếm: mã (để lọc), tên, số đơn, màu (theo màu trạng thái lá đơn). */
interface CountTile<Key extends string> {
  key: Key;
  label: string;
  count: number;
  color: FormStatus;
}

/** Phần trăm làm tròn của một phần trên tổng (tổng 0 thì 0). */
const percentOf = (part: number, total: number): number => (total ? Math.round((part * 100) / total) : 0);

/**
 * Ba khung thống kê.
 * @param props  xem FormStatsPanelProps
 * @returns      ba thẻ; đang tải hiện khung trống, lỗi hiện câu báo kèm nút ↻
 */
export function FormStatsPanel({
  statsQuery,
  activeStatus,
  activeFormTypeId,
  activeDeadlineState,
  onToggleStatus,
  onToggleFormType,
  onToggleDeadlineState,
}: FormStatsPanelProps) {
  const stats = statsQuery.data;
  const errorMessage = loadErrorMessage(statsQuery);

  return (
    <div className={styles.stats}>
      <section className={`${styles.card} ${styles.tileCard}`} aria-labelledby="stats-status-title">
        {/* Tiêu đề, nút ↻ (tải lại số liệu thống kê) · tổng số đơn */}
        <div className={styles.head}>
          <div className={styles.titleGroup}>
            <h2 id="stats-status-title">Theo trạng thái</h2>
            <RefreshButton query={statsQuery} label="thống kê theo trạng thái" size="small" />
          </div>
          {stats ? (
            <span className={styles.total}>
              <b>{stats.total}</b> đơn
            </span>
          ) : null}
        </div>
        {errorMessage ? <LoadError message={errorMessage} /> : null}
        {stats ? (
          <CountTiles
            tiles={FORM_STATUSES.map((status) => ({ key: status, label: FORM_STATUS_LABEL[status], count: stats.byStatus[status], color: status }))}
            total={stats.total}
            activeKey={activeStatus}
            onToggle={onToggleStatus}
          />
        ) : null}
        {!stats && !errorMessage ? <div className={styles.placeholder} aria-busy="true" /> : null}
      </section>

      <section className={`${styles.card} ${styles.typeCard}`} aria-labelledby="stats-type-title">
        {/* Tiêu đề, nút ↻ · số loại đơn. Hai khung dùng chung một lần tải, nên bấm ↻ ở khung nào cũng tải lại cả hai */}
        <div className={styles.head}>
          <div className={styles.titleGroup}>
            <h2 id="stats-type-title">Theo loại đơn</h2>
            <RefreshButton query={statsQuery} label="thống kê theo loại đơn" size="small" />
          </div>
          {stats ? (
            <span className={styles.total}>
              <b>{stats.byType.length}</b> loại đơn
            </span>
          ) : null}
        </div>
        {/* Lỗi tải: câu báo đỏ như khung Theo trạng thái; đang tải: khung trống */}
        {errorMessage ? <LoadError message={errorMessage} /> : null}
        {stats ? <FormTypeDonut stats={stats} activeFormTypeId={activeFormTypeId} onToggleFormType={onToggleFormType} /> : null}
        {!stats && !errorMessage ? <div className={styles.placeholder} aria-busy="true" /> : null}
      </section>

      <section className={styles.card} aria-labelledby="stats-deadline-title">
        {/* Tiêu đề, nút ↻ · số đơn có hạn (phần trăm tính trên số này), số đơn không có hạn */}
        <div className={styles.head}>
          <div className={styles.titleGroup}>
            <h2 id="stats-deadline-title">Theo tình trạng hạn</h2>
            <RefreshButton query={statsQuery} label="thống kê theo tình trạng hạn" size="small" />
          </div>
          {stats ? (
            <span className={styles.total}>
              <b>{stats.total - stats.noDeadline}</b> đơn có hạn
              {stats.noDeadline ? <span className={styles.totalNote}> · {stats.noDeadline} đơn không có hạn</span> : null}
            </span>
          ) : null}
        </div>
        {errorMessage ? <LoadError message={errorMessage} /> : null}
        {stats ? (
          <DeadlineDonut stats={stats} activeDeadlineState={activeDeadlineState} onToggleDeadlineState={onToggleDeadlineState} />
        ) : null}
        {!stats && !errorMessage ? <div className={styles.placeholder} aria-busy="true" /> : null}
      </section>
    </div>
  );
}

/**
 * Thanh tỉ lệ nhiều màu và các ô đếm (6 ô trạng thái, hoặc 6 ô tình trạng hạn).
 * @param tiles      các ô, theo thứ tự hiện
 * @param total      tổng để tính phần trăm
 * @param activeKey  ô đang lọc ở bảng (null = không lọc)
 * @param onToggle   bấm một ô
 * @returns          thanh và lưới ô; mỗi ô là nút bấm để lọc bảng
 */
function CountTiles<Key extends string>({
  tiles,
  total,
  activeKey,
  onToggle,
}: {
  tiles: CountTile<Key>[];
  total: number;
  activeKey: string | null;
  onToggle: (key: Key) => void;
}) {
  const shown = tiles.filter((tile) => tile.count > 0);
  return (
    <>
      <div className={styles.ratioBar} aria-hidden="true">
        {shown.length ? (
          shown.map((tile) => <span key={tile.key} className={styles[`bar_${tile.color}`]} style={{ flex: tile.count }} title={`${tile.label}: ${tile.count}`} />)
        ) : (
          <span style={{ flex: 1 }} />
        )}
      </div>
      <div className={styles.tiles}>
        {tiles.map((tile) => {
          const isOn = activeKey === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              className={`${styles.tile} ${isOn ? styles.on : ''}`}
              aria-pressed={isOn}
              title={`Bấm để lọc bảng theo “${tile.label}”`}
              onClick={() => onToggle(tile.key)}
            >
              <span className={styles.tileLabel}>
                <i className={styles[`bar_${tile.color}`]} />
                {tile.label}
              </span>
              <span className={styles.tileCount}>{tile.count}</span>
              <span className={styles.tilePercent}>{percentOf(tile.count, total)}%</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
