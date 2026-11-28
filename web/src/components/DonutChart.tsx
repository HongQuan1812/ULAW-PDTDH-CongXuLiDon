/* Hình vành khuyên dùng chung: khung "Theo loại đơn" ở Quản lí đơn, câu Chọn một / Danh sách thả xuống ở thẻ Thống kê loại đơn.
   Mỗi lát một màu biểu đồ (--chart-1 … --chart-5, 0 = xám "Khác"); lát từ 10% trở lên ghi phần trăm trên hình; tổng ở giữa.
   Chú thích do nơi dùng tự vẽ (ô màu lấy lớp từ sliceColorClass). */
import styles from './DonutChart.module.css';

/* Kích thước vành khuyên trong viewBox 0 0 200 200: tâm, bán kính giữa vành, độ dày vành */
const CENTER = 100;
const RING_RADIUS = 74;
const RING_WIDTH = 36;

/* Khoảng hở giữa hai lát, tính theo % chu vi */
const SLICE_GAP = 0.6;

/** Lát chiếm từ tỉ lệ này trở lên mới ghi phần trăm trên hình. */
const SLICE_LABEL_MIN_SHARE = 0.1;

/** Số màu biểu đồ; lát thứ 6 trở đi quay lại màu 1. */
export const CHART_COLOR_COUNT = 5;

/** Một lát của vành khuyên. */
export interface DonutSlice {
  /** Khóa riêng của lát */
  key: string;
  name: string;
  count: number;
  /** Tỉ lệ trên tổng, 0..1 */
  share: number;
  /** Thứ tự màu 1..5; 0 = xám (lát "Khác") */
  colorIndex: number;
}

/**
 * Phần trăm làm tròn để hiện; có mà dưới 1% thì ghi "<1%".
 * @param share  tỉ lệ 0..1
 * @returns      vd "28%"
 */
export function percentText(share: number): string {
  if (share > 0 && share < 0.005) return '<1%';
  return `${Math.round(share * 100)}%`;
}

/**
 * Lớp CSS tô màu biểu đồ cho ô màu ở chú thích (nền) và cho lát (nét).
 * @param colorIndex  thứ tự màu 1..5; 0 = xám
 * @returns           tên lớp
 */
export function sliceColorClass(colorIndex: number): string {
  return styles[`slice_${colorIndex}`]!;
}

interface DonutChartProps {
  slices: DonutSlice[];
  /** Số ở giữa hình */
  total: number;
  /** Chữ nhỏ dưới số ở giữa, vd "đơn" */
  unit: string;
  /** Lát đang làm nổi (rê chuột, đang lọc), null = không lát nào */
  focusedKey: string | null;
  onHover: (key: string | null) => void;
  /** Bấm một lát; bỏ trống = lát không bấm được */
  onClickSlice?: (key: string) => void;
}

/**
 * Hình vành khuyên: mỗi lát là một cung tròn (vẽ bằng nét của hình tròn, nên lát 100% vẫn đúng), tổng ở giữa.
 * Hình ẩn với trình đọc màn hình; số liệu đủ ở chú thích.
 * @param props  xem DonutChartProps
 * @returns      khối hình
 */
export function DonutChart({ slices, total, unit, focusedKey, onHover, onClickSlice }: DonutChartProps) {
  // Vị trí bắt đầu của từng lát, tính theo % chu vi từ 12 giờ, theo chiều kim đồng hồ
  const gap = slices.length > 1 ? SLICE_GAP : 0;
  let startPercent = 0;
  const placedSlices = slices.map((slice) => {
    const sweepPercent = slice.share * 100;
    const placed = { slice, startPercent, sweepPercent };
    startPercent += sweepPercent;
    return placed;
  });

  return (
    <div className={`${styles.donut} ${focusedKey ? styles.hasFocus : ''}`} aria-hidden="true" onMouseLeave={() => onHover(null)}>
      <svg viewBox="0 0 200 200">
        {/* Vành nền (thấy khi chưa có gì) */}
        <circle cx={CENTER} cy={CENTER} r={RING_RADIUS} fill="none" className={styles.ringTrack} strokeWidth={RING_WIDTH} />

        {/* Các lát (lát 0 thì không vẽ) */}
        {placedSlices
          .filter(({ sweepPercent }) => sweepPercent > 0)
          .map(({ slice, startPercent: sliceStart, sweepPercent }) => {
            const visiblePercent = Math.max(sweepPercent - gap, 0.4);
            return (
              <circle
                key={slice.key}
                cx={CENTER}
                cy={CENTER}
                r={RING_RADIUS}
                fill="none"
                strokeWidth={RING_WIDTH}
                pathLength={100}
                strokeDasharray={`${visiblePercent} ${100 - visiblePercent}`}
                strokeDashoffset={-(sliceStart + gap / 2)}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                className={`${styles.sliceArc} ${onClickSlice ? styles.clickable : ''} ${sliceColorClass(slice.colorIndex)} ${
                  slice.key === focusedKey ? styles.focused : ''
                }`}
                onMouseEnter={() => onHover(slice.key)}
                onClick={onClickSlice ? () => onClickSlice(slice.key) : undefined}
              >
                <title>{`${slice.name}: ${slice.count} ${unit} (${percentText(slice.share)})`}</title>
              </circle>
            );
          })}

        {/* Phần trăm trên các lát lớn */}
        {placedSlices
          .filter(({ slice }) => slice.share >= SLICE_LABEL_MIN_SHARE)
          .map(({ slice, startPercent: sliceStart, sweepPercent }) => {
            const middleAngle = ((sliceStart + sweepPercent / 2) / 100) * Math.PI * 2;
            return (
              <text
                key={slice.key}
                x={CENTER + RING_RADIUS * Math.sin(middleAngle)}
                y={CENTER - RING_RADIUS * Math.cos(middleAngle)}
                textAnchor="middle"
                dominantBaseline="central"
                className={`${styles.sliceLabel} ${slice.colorIndex === 0 ? styles.sliceLabelOther : ''}`}
              >
                {percentText(slice.share)}
              </text>
            );
          })}
      </svg>

      {/* Tổng ở giữa */}
      <div className={styles.donutCenter}>
        <b>{total}</b>
        <span>{unit}</span>
      </div>
    </div>
  );
}
