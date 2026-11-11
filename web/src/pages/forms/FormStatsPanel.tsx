/* Hai khung thống kê đầu trang Quản lí đơn (như renderStats() / typeChart() của bản mẫu):
   "Theo trạng thái" (tổng, thanh tỉ lệ nhiều màu, 6 ô) và "Theo loại đơn" (biểu đồ cột 0–100%).
   Số liệu đếm trên TẤT CẢ đơn, không đổi theo ô tìm kiếm / bộ lọc của bảng.
   Bấm một ô trạng thái hoặc một cột loại đơn thì lọc bảng bên dưới; bấm lại để bỏ lọc. */
import {
  FORM_STATUSES,
  FORM_STATUS_LABEL,
  type FormStats,
  type FormStatus,
} from '@ulaw/shared';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import type { UseQueryResult } from '@tanstack/react-query';
import styles from './FormStatsPanel.module.css';

/** Các vạch trên trục tung của biểu đồ (% trên tổng số đơn). */
const CHART_TICKS = [0, 25, 50, 75, 100];

interface FormStatsPanelProps {
  /** Kết quả useFormStats() */
  statsQuery: UseQueryResult<FormStats>;
  /** Trạng thái đang lọc ở bảng (null = không lọc) */
  activeStatus: string | null;
  /** Loại đơn đang lọc ở bảng (null = không lọc) */
  activeFormTypeId: string | null;
  /** Bấm ô trạng thái */
  onToggleStatus: (status: FormStatus) => void;
  /** Bấm cột loại đơn */
  onToggleFormType: (formTypeId: string) => void;
}

/** Phần trăm làm tròn của một phần trên tổng (tổng 0 thì 0). */
const percentOf = (part: number, total: number): number => (total ? Math.round((part * 100) / total) : 0);

/**
 * Hai khung thống kê.
 * @param props  xem FormStatsPanelProps
 * @returns      hai thẻ; đang tải hiện khung trống, lỗi hiện câu báo kèm nút ↻
 */
export function FormStatsPanel({ statsQuery, activeStatus, activeFormTypeId, onToggleStatus, onToggleFormType }: FormStatsPanelProps) {
  const stats = statsQuery.data;
  const errorMessage = loadErrorMessage(statsQuery);

  return (
    <div className={styles.stats}>
      <section className={styles.card} aria-labelledby="stats-status-title">
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
        {stats ? <StatusPart stats={stats} activeStatus={activeStatus} onToggleStatus={onToggleStatus} /> : null}
        {!stats && !errorMessage ? <div className={styles.placeholder} aria-busy="true" /> : null}
      </section>

      <section className={styles.card} aria-labelledby="stats-type-title">
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
        {stats ? <TypeChart stats={stats} activeFormTypeId={activeFormTypeId} onToggleFormType={onToggleFormType} /> : null}
        {!stats && !errorMessage ? <div className={styles.placeholder} aria-busy="true" /> : null}
      </section>
    </div>
  );
}

/**
 * Thanh tỉ lệ nhiều màu và 6 ô trạng thái.
 * @returns  thanh và lưới ô; mỗi ô là nút bấm để lọc bảng
 */
function StatusPart({ stats, activeStatus, onToggleStatus }: Pick<FormStatsPanelProps, 'activeStatus' | 'onToggleStatus'> & { stats: FormStats }) {
  const shown = FORM_STATUSES.filter((status) => stats.byStatus[status] > 0);
  return (
    <>
      <div className={styles.ratioBar} aria-hidden="true">
        {shown.length ? (
          shown.map((status) => (
            <span
              key={status}
              className={styles[`bar_${status}`]}
              style={{ flex: stats.byStatus[status] }}
              title={`${FORM_STATUS_LABEL[status]}: ${stats.byStatus[status]}`}
            />
          ))
        ) : (
          <span style={{ flex: 1 }} />
        )}
      </div>
      <div className={styles.tiles}>
        {FORM_STATUSES.map((status) => {
          const isOn = activeStatus === status;
          return (
            <button
              key={status}
              type="button"
              className={`${styles.tile} ${isOn ? styles.on : ''}`}
              aria-pressed={isOn}
              title={`Bấm để lọc bảng theo “${FORM_STATUS_LABEL[status]}”`}
              onClick={() => onToggleStatus(status)}
            >
              <span className={styles.tileLabel}>
                <i className={styles[`bar_${status}`]} />
                {FORM_STATUS_LABEL[status]}
              </span>
              <span className={styles.tileCount}>{stats.byStatus[status]}</span>
              <span className={styles.tilePercent}>{percentOf(stats.byStatus[status], stats.total)}%</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * Biểu đồ cột: trục x là loại đơn (nhãn nghiêng), trục y là % trên tổng số đơn; mỗi cột là nút bấm để lọc bảng.
 * @returns  biểu đồ, cuộn ngang khi nhiều loại đơn
 */
function TypeChart({ stats, activeFormTypeId, onToggleFormType }: Pick<FormStatsPanelProps, 'activeFormTypeId' | 'onToggleFormType'> & { stats: FormStats }) {
  return (
    <div className={styles.chart} role="group" aria-label="Biểu đồ số đơn theo loại đơn">
      <div className={styles.yAxis} aria-hidden="true">
        {CHART_TICKS.map((tick) => (
          <span key={tick} style={{ bottom: `${tick}%` }}>
            {tick}%
          </span>
        ))}
      </div>
      <div className={styles.scroll}>
        <div className={styles.inner} style={{ ['--cols' as string]: stats.byType.length }}>
          <div className={styles.plot}>
            {CHART_TICKS.map((tick) => (
              <i key={tick} className={styles.gridLine} style={{ bottom: `${tick}%` }} />
            ))}
            {stats.byType.map((type) => {
              const percent = percentOf(type.count, stats.total);
              const isOn = activeFormTypeId === type.formTypeId;
                            return (
                <button
                  key={type.formTypeId}
                  type="button"
                  className={`${styles.column} ${isOn ? styles.on : ''} ${type.formTypeStatus === 'open' ? '' : styles.off}`}
                  aria-pressed={isOn}
                  aria-label={`${type.formTypeName}: ${type.count} đơn, ${percent}%. Bấm để lọc bảng`}
                  title={`${type.formTypeName}: ${type.count} đơn (${percent}%) — bấm để lọc bảng`}
                  onClick={() => onToggleFormType(type.formTypeId)}
                >
                  <span className={styles.bar} style={{ height: `${stats.total ? (type.count * 100) / stats.total : 0}%` }}>
                    <b>
                      {percent}%<small>{type.count} đơn</small>
                    </b>
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.xAxis} aria-hidden="true">
            {stats.byType.map((type) => (
              <span key={type.formTypeId}>
                <em title={type.formTypeName}>{type.formTypeName}</em>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
