/* Thanh công cụ phía trên bảng: ô tìm kiếm, nút Sắp xếp, nút Lọc, và các nút thêm của từng trang
   (vd Hiện CCCD) nằm ngay sau nút Lọc. Mỗi lúc chỉ mở một bảng nổi. */
import { useCallback, useState, type ReactNode } from 'react';
import { FilterPanel } from './FilterPanel';
import { FilterIcon, SearchIcon, SortIcon } from './icons';
import { SortPanel } from './SortPanel';
import { createFilterRule, isFilterActive, type FieldOption, type FilterRule, type SortRules, type TableField } from './tableTools';
import { ToolPopover } from './ToolPopover';
import styles from './table.module.css';

interface TableToolbarProps<Row> {
  fields: readonly TableField<Row>[];
  /** Lựa chọn của các cột select không có lựa chọn cố định, theo tên cột (máy chủ gửi kèm trang, hoặc filterOptionsOf) */
  filterOptions: Readonly<Record<string, FieldOption[]>>;
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
  /** Tùy chọn: các nút thêm, nằm ngay sau nút Lọc, vd <CccdToggleButton> */
  extraButtons?: ReactNode;
}

type OpenTool = 'sort' | 'filter' | null;

/**
 * Thanh công cụ của bảng.
 * @param props  xem TableToolbarProps
 * @returns      ô tìm kiếm, hai nút Sắp xếp / Lọc và các nút thêm (nếu có)
 */
export function TableToolbar<Row>(props: TableToolbarProps<Row>) {
  const { fields, filterOptions, query, onQueryChange, searchPlaceholder, searchLabel } = props;
  const { sorting, onSortingChange, defaultSortNote, filterRules, onFilterRulesChange, defaultFilterKey, extraButtons } = props;
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
            filterOptions={filterOptions}
            filterRules={filterRules}
            onChange={onFilterRulesChange}
            defaultFieldKey={defaultFilterKey}
          />
        </ToolPopover>
        {extraButtons}
      </div>
    </div>
  );
}
