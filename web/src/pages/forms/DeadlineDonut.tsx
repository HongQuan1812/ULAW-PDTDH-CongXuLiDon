/* Vành khuyên "Theo tình trạng hạn" ở khung thống kê Quản lí đơn.
   Mỗi tình trạng một lát, màu như nhãn tình trạng hạn ở bảng (Quá hạn đỏ, Sắp tới hạn vàng…, Không có hạn xám).
   Chú thích đủ 6 tình trạng (kể cả chưa có đơn, để vẫn bấm lọc được), kèm số đơn và phần trăm.
   Bấm một lát hoặc dòng chú thích thì lọc bảng bên dưới; bấm lại để bỏ lọc. */
import { useState } from 'react';
import { DEADLINE_STATES, DEADLINE_STATE_LABEL, type DeadlineState, type FormStats } from '@ulaw/shared';
import { DonutChart, percentText, sliceClassOf, type DonutSlice } from '../../components/DonutChart';
import { DEADLINE_STATE_COLOR } from '../../components/StatusPill';
import styles from './FormStatsPanel.module.css';

interface DeadlineDonutProps {
  stats: FormStats;
  /** Tình trạng hạn đang lọc ở bảng (null = không lọc) */
  activeDeadlineState: string | null;
  /** Bấm một tình trạng hạn */
  onToggleDeadlineState: (state: DeadlineState) => void;
}

/**
 * Vành khuyên và chú thích của khung "Theo tình trạng hạn".
 * @param props  xem DeadlineDonutProps
 * @returns      hình (tổng số đơn ở giữa) và chú thích; mỗi dòng chú thích là nút bấm để lọc bảng
 */
export function DeadlineDonut({ stats, activeDeadlineState, onToggleDeadlineState }: DeadlineDonutProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const focusedKey = hoveredKey ?? activeDeadlineState;

  // Mỗi tình trạng một lát; Không có hạn dùng màu xám "Khác" của biểu đồ (colorIndex 0, không có màu riêng)
  const slices: DonutSlice[] = DEADLINE_STATES.map((state) => ({
    key: state,
    name: DEADLINE_STATE_LABEL[state],
    count: stats.byDeadline[state],
    share: stats.total ? stats.byDeadline[state] / stats.total : 0,
    colorIndex: 0,
    colorClass: state === 'none' ? undefined : styles[`bar_${DEADLINE_STATE_COLOR[state]}`],
  }));

  return (
    <div className={styles.donutBody}>
      <DonutChart
        slices={slices}
        total={stats.total}
        unit="đơn"
        focusedKey={focusedKey}
        onHover={setHoveredKey}
        onClickSlice={(key) => onToggleDeadlineState(key as DeadlineState)}
      />

      {/* Chú thích: màu, tên, số đơn, phần trăm */}
      <ul className={styles.legend} onMouseLeave={() => setHoveredKey(null)}>
        {slices.map((slice) => {
          const isOn = activeDeadlineState === slice.key;
          return (
            <li key={slice.key}>
              <button
                type="button"
                className={`${styles.legendRow} ${slice.key === focusedKey ? styles.focused : ''} ${isOn ? styles.on : ''}`}
                aria-pressed={isOn}
                title={`Bấm để lọc bảng theo “${slice.name}”`}
                onMouseEnter={() => setHoveredKey(slice.key)}
                onFocus={() => setHoveredKey(slice.key)}
                onBlur={() => setHoveredKey(null)}
                onClick={() => onToggleDeadlineState(slice.key as DeadlineState)}
              >
                <i className={sliceClassOf(slice)} />
                <span className={styles.legendName}>{slice.name}</span>
                <span className={styles.legendCount}>{slice.count} đơn</span>
                <span className={styles.legendPercent}>{percentText(slice.share)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
