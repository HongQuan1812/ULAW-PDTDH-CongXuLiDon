/* Vành khuyên "Theo loại đơn" ở khung thống kê Quản lí đơn.
   5 loại đơn nhiều đơn nhất mỗi loại một màu, các loại còn lại gộp thành "Khác" màu xám (bấm để xem danh sách).
   Chỉ lát từ 10% trở lên ghi phần trăm trên hình; số đơn và phần trăm đủ ở chú thích.
   Bấm một loại đơn (lát hoặc dòng chú thích) thì lọc bảng bên dưới; bấm lại để bỏ lọc. */
import { useState } from 'react';
import type { FormStats, FormTypeCount } from '@ulaw/shared';
import { DonutChart, percentText, sliceColorClass, type DonutSlice } from '../../components/DonutChart';
import styles from './FormStatsPanel.module.css';

/** Số loại đơn có màu riêng; còn lại gộp thành "Khác". */
const COLORED_TYPE_COUNT = 5;

/** Khóa của lát "Khác" (không trùng id loại đơn nào). */
const OTHER_KEY = '__other__';

interface FormTypeDonutProps {
  stats: FormStats;
  /** Loại đơn đang lọc ở bảng (null = không lọc) */
  activeFormTypeId: string | null;
  /** Bấm một loại đơn */
  onToggleFormType: (formTypeId: string) => void;
}

/**
 * Chia các loại đơn thành lát có màu và phần "Khác".
 * @param stats  số liệu thống kê (byType đã sắp từ nhiều đến ít)
 * @returns      slices: các lát theo thứ tự vẽ · otherTypes: các loại đơn nằm trong "Khác"
 */
function buildSlices(stats: FormStats): { slices: DonutSlice[]; otherTypes: FormTypeCount[] } {
  // 5 loại nhiều nhất (có đơn) có màu riêng
  const shareOf = (count: number) => (stats.total ? count / stats.total : 0);
  const coloredTypes = stats.byType.filter((type) => type.count > 0).slice(0, COLORED_TYPE_COUNT);
  const coloredIds = new Set(coloredTypes.map((type) => type.formTypeId));
  const otherTypes = stats.byType.filter((type) => !coloredIds.has(type.formTypeId));
  const slices: DonutSlice[] = coloredTypes.map((type, i) => ({
    key: type.formTypeId,
    name: type.formTypeName,
    count: type.count,
    share: shareOf(type.count),
    colorIndex: i + 1,
  }));

  // Còn lại gộp thành "Khác" (kể cả loại chưa có đơn, để vẫn bấm lọc được)
  if (otherTypes.length) {
    const otherCount = otherTypes.reduce((sum, type) => sum + type.count, 0);
    slices.push({ key: OTHER_KEY, name: `Khác (${otherTypes.length} loại đơn)`, count: otherCount, share: shareOf(otherCount), colorIndex: 0 });
  }
  return { slices, otherTypes };
}

/**
 * Vành khuyên và chú thích của khung "Theo loại đơn".
 * @param props  xem FormTypeDonutProps
 * @returns      hình (tổng số đơn ở giữa) và chú thích; mỗi dòng chú thích là nút bấm để lọc bảng
 */
export function FormTypeDonut({ stats, activeFormTypeId, onToggleFormType }: FormTypeDonutProps) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const { slices, otherTypes } = buildSlices(stats);
  const typeById = new Map(stats.byType.map((type) => [type.formTypeId, type]));

  // Loại đang lọc nằm trong "Khác" thì mở sẵn danh sách và làm nổi lát "Khác"
  const activeInOther = otherTypes.some((type) => type.formTypeId === activeFormTypeId);
  const showOtherList = otherOpen || activeInOther;
  const activeSliceKey = activeInOther ? OTHER_KEY : activeFormTypeId;
  const focusedKey = hoveredKey ?? activeSliceKey;

  /**
   * Bấm lát hoặc dòng chú thích: lát "Khác" thì mở / đóng danh sách, lát khác thì lọc bảng.
   * @param key  khóa của lát
   */
  const clickSlice = (key: string) => (key === OTHER_KEY ? setOtherOpen((open) => !open) : onToggleFormType(key));

  return (
    <div className={styles.donutBody}>
      <DonutChart
        slices={slices}
        total={stats.total}
        unit="đơn"
        focusedKey={slices.some((slice) => slice.key === focusedKey) ? focusedKey : null}
        onHover={setHoveredKey}
        onClickSlice={clickSlice}
      />

      {/* Chú thích: màu, tên, số đơn, phần trăm */}
      <ul className={styles.legend} onMouseLeave={() => setHoveredKey(null)}>
        {slices.map((slice) => {
          const isOther = slice.key === OTHER_KEY;
          const type = typeById.get(slice.key);
          const isOn = !isOther && activeFormTypeId === slice.key;
          return (
            <li key={slice.key}>
              <button
                type="button"
                className={`${styles.legendRow} ${slice.key === focusedKey ? styles.focused : ''} ${isOn ? styles.on : ''} ${
                  type && type.formTypeStatus !== 'open' ? styles.off : ''
                }`}
                aria-pressed={isOther ? undefined : isOn}
                aria-expanded={isOther ? showOtherList : undefined}
                title={isOther ? 'Bấm để xem các loại đơn còn lại' : `Bấm để lọc bảng theo “${slice.name}”`}
                onMouseEnter={() => setHoveredKey(slice.key)}
                onFocus={() => setHoveredKey(slice.key)}
                onBlur={() => setHoveredKey(null)}
                onClick={() => clickSlice(slice.key)}
              >
                <i className={sliceColorClass(slice.colorIndex)} />
                <span className={styles.legendName}>
                  {slice.name}
                  {isOther ? <span className={styles.chevron}>{showOtherList ? ' ▴' : ' ▾'}</span> : null}
                </span>
                <span className={styles.legendCount}>{slice.count} đơn</span>
                <span className={styles.legendPercent}>{percentText(slice.share)}</span>
              </button>

              {/* Danh sách loại đơn trong "Khác", bấm từng loại để lọc */}
              {isOther && showOtherList ? (
                <ul className={styles.otherList}>
                  {otherTypes.map((otherType) => {
                    const isOtherOn = activeFormTypeId === otherType.formTypeId;
                    return (
                      <li key={otherType.formTypeId}>
                        <button
                          type="button"
                          className={`${styles.otherRow} ${isOtherOn ? styles.on : ''} ${otherType.formTypeStatus === 'open' ? '' : styles.off}`}
                          aria-pressed={isOtherOn}
                          title={`Bấm để lọc bảng theo “${otherType.formTypeName}”`}
                          onClick={() => onToggleFormType(otherType.formTypeId)}
                        >
                          <span className={styles.legendName}>{otherType.formTypeName}</span>
                          <span className={styles.legendCount}>{otherType.count} đơn</span>
                          <span className={styles.legendPercent}>{percentText(stats.total ? otherType.count / stats.total : 0)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
