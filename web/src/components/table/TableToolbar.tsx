/* Thanh công cụ phía trên bảng (như .tools của bản mẫu): ô tìm kiếm, nút Sắp xếp, nút Lọc.
   Mỗi lúc chỉ mở một bảng nổi. */
import { useCallback, useState } from 'react';
import { FilterPanel } from './FilterPanel';
import { FilterIcon, SearchIcon, SortIcon } from './icons';
import { SortPanel } from './SortPanel';
import { createFilterRule, isFilterActive, type FilterRule, type SortRules, type TableField } from './tableTools';
import { ToolPopover } from './ToolPopover';
import styles from './table.module.css';

interface TableToolbarProps<Row> {
  fields: readonly TableField<Row>[];
  /** Toàn bộ dữ liệu, để bảng Lọc lấy các lựa chọn */
  rows: readonly Row[];
  query: string;
  onQueryChange: (query: string) => void;
  /** Gợi ý trong ô tìm kiếm, vd "Tìm theo mã đơn, loại đơn…" */
  searchPlaceholder: string;
  /** Tên ô tìm kiếm cho trình đọc màn hình, vd "Tìm đơn đã nộp" */
  searchLabel: string;
  sorting: SortRules;
  onSortingChange: (sorting: SortRules) => void;
  /** Câu giải thích thứ tự mặc định trong bảng Sắp xếp */
  defaultSortNote: string;
  filterRules: FilterRule[];
  onFilterRulesChange: (filterRules: FilterRule[]) => void;
  /** Cột của điều kiện lọc mới thêm, vd 'status' */
  defaultFilterKey: string;
}

type OpenTool = 'sort' | 'filter' | null;

/**
 * Thanh công cụ của bảng.
 * @param props  xem TableToolbarProps
 * @returns      ô tìm kiếm và hai nút Sắp xếp / Lọc
 */
export function TableToolbar<Row>(props: TableToolbarProps<Row>) {
  const { fields, rows, query, onQueryChange, searchPlaceholder, searchLabel } = props;
  const { sorting, onSortingChange, defaultSortNote, filterRules, onFilterRulesChange, defaultFilterKey } = props;
  const [openTool, setOpenTool] = useState<OpenTool>(null);

  // Bấm nút: mở bảng của nút (đóng bảng kia), bấm lại thì đóng.
  // Mở bảng Lọc khi chưa có điều kiện nào thì thêm sẵn một điều kiện trống
  const toggle = (tool: Exclude<OpenTool, null>) => {
    if (openTool === tool) {
      setOpenTool(null);
      return;
    }
    if (tool === 'filter' && !filterRules.length) onFilterRulesChange([createFilterRule(defaultFilterKey)]);
    setOpenTool(tool);
  };
  const close = useCallback(() => setOpenTool(null), []);

  return (
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <SearchIcon />
        <input
          type="search"
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <div className={styles.toolButtons}>
        <ToolPopover
          label="Sắp xếp"
          icon={<SortIcon />}
          count={sorting.length}
          open={openTool === 'sort'}
          onToggle={() => toggle('sort')}
          onClose={close}
        >
          <SortPanel fields={fields} sorting={sorting} onChange={onSortingChange} defaultNote={defaultSortNote} />
        </ToolPopover>
        <ToolPopover
          label="Lọc"
          icon={<FilterIcon />}
          count={filterRules.filter(isFilterActive).length}
          open={openTool === 'filter'}
          onToggle={() => toggle('filter')}
          onClose={close}
        >
          <FilterPanel
            fields={fields}
            rows={rows}
            filterRules={filterRules}
            onChange={onFilterRulesChange}
            defaultFieldKey={defaultFilterKey}
          />
        </ToolPopover>
      </div>
    </div>
  );
}
