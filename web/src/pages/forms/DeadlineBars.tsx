/* Thanh ngang "Theo tình trạng hạn" ở khung thống kê Quản lí đơn.
   Mỗi tình trạng một hàng: tên, thanh dài theo phần trăm (màu như nhãn tình trạng hạn ở bảng: Quá hạn đỏ, Sắp tới hạn vàng…, Không có hạn xám),
   số đơn, phần trăm. Đủ 6 tình trạng (kể cả chưa có đơn, để vẫn bấm lọc được).
   Bấm một hàng thì lọc bảng bên dưới; bấm lại để bỏ lọc. */
import { DEADLINE_STATES, DEADLINE_STATE_LABEL, type DeadlineState, type FormStats } from '@ulaw/shared';
import { percentText } from '../../components/DonutChart';
import { DEADLINE_STATE_COLOR } from '../../components/StatusPill';
import styles from './FormStatsPanel.module.css';

interface DeadlineBarsProps {
  stats: FormStats;
  /** Tình trạng hạn đang lọc ở bảng (null = không lọc) */
  activeDeadlineState: string | null;
  /** Bấm một tình trạng hạn */
  onToggleDeadlineState: (state: DeadlineState) => void;
}

/**
 * Các hàng thanh ngang của khung "Theo tình trạng hạn".
 * @param props  xem DeadlineBarsProps
 * @returns      danh sách hàng; mỗi hàng là nút bấm để lọc bảng
 */
export function DeadlineBars({ stats, activeDeadlineState, onToggleDeadlineState }: DeadlineBarsProps) {
  return (
    <ul className={styles.deadlineBars}>
      {DEADLINE_STATES.map((state) => {
        const name = DEADLINE_STATE_LABEL[state];
        const count = stats.byDeadline[state];
        const share = stats.total ? count / stats.total : 0;
        const isOn = activeDeadlineState === state;
        return (
          <li key={state}>
            <button
              type="button"
              className={`${styles.deadlineBarRow} ${isOn ? styles.on : ''}`}
              aria-pressed={isOn}
              title={`Bấm để lọc bảng theo “${name}”`}
              onClick={() => onToggleDeadlineState(state)}
            >
              <span className={styles.legendName}>{name}</span>
              <span className={styles.deadlineTrack} aria-hidden="true">
                <span className={styles[`bar_${DEADLINE_STATE_COLOR[state]}`]} style={{ width: `${share * 100}%` }} />
              </span>
              <span className={styles.legendCount}>{count} đơn</span>
              <span className={styles.legendPercent}>{percentText(share)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
