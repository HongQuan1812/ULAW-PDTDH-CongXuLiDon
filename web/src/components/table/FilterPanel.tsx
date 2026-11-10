/* Nội dung bảng nổi "Lọc" (như renderFilt() trong artifact/js/table-tools.js):
   nhiều điều kiện, dòng phải thỏa tất cả. Mỗi điều kiện: cột · "=" hoặc "Trong khoảng" · giá trị. */
import {
  createFilterRule,
  filterOperators,
  selectOptions,
  type FilterOperator,
  type FilterRule,
  type TableField,
} from './tableTools';
import styles from './table.module.css';

interface FilterPanelProps<Row> {
  fields: readonly TableField<Row>[];
  /** Toàn bộ dữ liệu, để lấy các lựa chọn của cột select */
  rows: readonly Row[];
  filterRules: FilterRule[];
  onChange: (filterRules: FilterRule[]) => void;
  /** Cột của điều kiện mới thêm, vd 'status' */
  defaultFieldKey: string;
}

/**
 * Bảng nổi Lọc.
 * @param props  xem FilterPanelProps
 * @returns      danh sách điều kiện lọc và các nút thêm / xóa
 */
export function FilterPanel<Row>({ fields, rows, filterRules, onChange, defaultFieldKey }: FilterPanelProps<Row>) {
  // Sửa một điều kiện; đổi cột hoặc đổi "=" / "Trong khoảng" thì xóa giá trị cũ
  const updateRule = (ruleId: number, changes: Partial<FilterRule>) =>
    onChange(filterRules.map((rule) => (rule.id === ruleId ? { ...rule, ...changes } : rule)));
  const clearedValues = { value: '', from: '', to: '' };

  return (
    <>
      <p className={styles.popTitle}>Lọc theo · thỏa tất cả điều kiện</p>

      {filterRules.length ? (
        filterRules.map((rule) => {
          const field = fields.find((candidate) => candidate.key === rule.fieldKey);
          if (!field) return null;
          return (
            <div key={rule.id} className={styles.popRow}>
              <select
                aria-label="Cột"
                value={rule.fieldKey}
                onChange={(event) =>
                  updateRule(rule.id, { fieldKey: event.target.value, operator: 'equals', ...clearedValues })
                }
              >
                {fields.map((candidate) => (
                  <option key={candidate.key} value={candidate.key}>
                    {candidate.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Điều kiện"
                className={styles.operatorSelect}
                value={rule.operator}
                onChange={(event) =>
                  updateRule(rule.id, { operator: event.target.value as FilterOperator, ...clearedValues })
                }
              >
                {filterOperators(field.type).map(([operator, label]) => (
                  <option key={operator} value={operator}>
                    {label}
                  </option>
                ))}
              </select>
              <FilterValueInputs field={field} rows={rows} rule={rule} onChange={(changes) => updateRule(rule.id, changes)} />
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Bỏ điều kiện lọc"
                onClick={() => onChange(filterRules.filter((current) => current.id !== rule.id))}
              >
                ×
              </button>
            </div>
          );
        })
      ) : (
        <p className={styles.emptyNote}>Chưa có bộ lọc nào.</p>
      )}

      <div className={styles.popFoot}>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => onChange([...filterRules, createFilterRule(defaultFieldKey)])}
        >
          + Thêm bộ lọc
        </button>
        {filterRules.length > 0 && (
          <button type="button" className={`${styles.linkButton} ${styles.linkMuted}`} onClick={() => onChange([])}>
            Xóa tất cả
          </button>
        )}
      </div>
    </>
  );
}

/**
 * Ô nhập giá trị của một điều kiện lọc, theo kiểu cột và điều kiện:
 * select → danh sách chọn · chữ → ô chữ · số / ngày → một ô, hoặc hai ô "Từ … đến …" khi lọc trong khoảng.
 * @param field     cột của điều kiện
 * @param rows      toàn bộ dữ liệu (lấy lựa chọn cho cột select)
 * @param rule      điều kiện đang sửa
 * @param onChange  gọi với phần giá trị thay đổi, vd { value: 'xet' }
 * @returns         các ô nhập
 */
function FilterValueInputs<Row>({
  field,
  rows,
  rule,
  onChange,
}: {
  field: TableField<Row>;
  rows: readonly Row[];
  rule: FilterRule;
  onChange: (changes: Partial<FilterRule>) => void;
}) {
  if (field.type === 'select') {
    return (
      <select aria-label="Giá trị" value={rule.value} onChange={(event) => onChange({ value: event.target.value })}>
        <option value="">Chọn…</option>
        {selectOptions(field, rows).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'text') {
    return (
      <input
        aria-label="Giá trị"
        placeholder="Nhập giá trị"
        value={rule.value}
        onChange={(event) => onChange({ value: event.target.value })}
      />
    );
  }

  // Số và ngày
  const inputType = field.type === 'number' ? 'number' : 'date';
  if (rule.operator === 'range') {
    return (
      <>
        <input
          type={inputType}
          aria-label={inputType === 'date' ? 'Từ ngày' : 'Từ'}
          placeholder="Từ"
          value={rule.from}
          onChange={(event) => onChange({ from: event.target.value })}
        />
        <span className={styles.rangeTo}>đến</span>
        <input
          type={inputType}
          aria-label={inputType === 'date' ? 'Đến ngày' : 'Đến'}
          placeholder="Đến"
          value={rule.to}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </>
    );
  }
  return (
    <input
      type={inputType}
      aria-label={inputType === 'date' ? 'Ngày' : 'Giá trị'}
      placeholder={inputType === 'number' ? 'Nhập số' : undefined}
      value={rule.value}
      onChange={(event) => onChange({ value: event.target.value })}
    />
  );
}
