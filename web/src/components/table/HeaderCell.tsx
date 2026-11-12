import { ArrowIcon, FilterIcon } from './icons';
import { SORT_DIRECTION_LABELS, isFilterActive, type FilterRule, type SortRules, type TableField } from './tableTools';
import styles from './table.module.css';

/**
 * Ô tiêu đề cột: tên cột, kèm mũi tên khi cột đang được sắp xếp
 * (có số thứ tự ưu tiên khi sắp xếp nhiều cột) và cái phễu khi cột đang được lọc. Cột có biểu tượng thì tô màu.
 * @param field        cột
 * @param sorting      các dòng sắp xếp người dùng đã chọn (không tính thứ tự mặc định)
 * @param filterRules  các điều kiện lọc
 * @param className    class thêm cho ô, vd đường kẻ ngăn nhóm cột
 * @returns            thẻ <th>
 */
export function HeaderCell<Row>({
  field,
  sorting,
  filterRules,
  className = '',
}: {
  field: TableField<Row>;
  sorting: SortRules;
  filterRules: readonly FilterRule[];
  className?: string;
}) {
  const sortIndex = sorting.findIndex((rule) => rule.id === field.key);
  const sortRule = sorting[sortIndex];
  const filtered = filterRules.some((rule) => rule.fieldKey === field.key && isFilterActive(rule));
  const directionLabel = sortRule ? SORT_DIRECTION_LABELS[field.type][sortRule.desc ? 1 : 0] : '';

  return (
    <th className={`${className} ${sortRule || filtered ? styles.headerActive : ''}`}>
      <span className={styles.headerLabel}>
        {field.label}
        {sortRule && (
          <span className={styles.indicator} title={`Đang sắp xếp: ${directionLabel}`}>
            <ArrowIcon direction={sortRule.desc ? 'down' : 'up'} />
            {sorting.length > 1 && <small>{sortIndex + 1}</small>}
          </span>
        )}
        {filtered && (
          <span className={styles.indicator} title="Đang lọc theo cột này">
            <FilterIcon size={14} />
          </span>
        )}
      </span>
    </th>
  );
}
