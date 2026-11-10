/* Nội dung bảng nổi "Sắp xếp" (như renderSort() trong artifact/js/table-tools.js):
   sắp xếp nhiều cột, dòng trên ưu tiên trước; đổi thứ tự ưu tiên bằng cách kéo ⋮⋮ hoặc bấm ↑ ↓. */
import { useState, type DragEvent } from 'react';
import { SORT_DIRECTION_LABELS, type SortRules, type TableField } from './tableTools';
import styles from './table.module.css';

interface SortPanelProps<Row> {
  fields: readonly TableField<Row>[];
  /** Các dòng sắp xếp người dùng đã chọn ([] = chưa chọn, bảng đang theo thứ tự mặc định) */
  sorting: SortRules;
  onChange: (sorting: SortRules) => void;
  /** Câu giải thích thứ tự mặc định, hiện khi chưa chọn, vd "Bảng đang xếp đơn mới nộp lên trên." */
  defaultNote: string;
}

/** Đang kéo dòng nào, và đang rê trên nửa trên / nửa dưới của dòng nào (để vẽ vạch chỗ thả). */
interface DragState {
  fromIndex: number;
  overIndex: number | null;
  overHalf: 'top' | 'bottom';
}

/**
 * Chuyển một dòng sắp xếp sang vị trí khác.
 * @param sorting    các dòng hiện tại
 * @param fromIndex  vị trí dòng cần chuyển
 * @param toIndex    vị trí mới (tính sau khi đã nhấc dòng ra)
 * @returns          các dòng theo thứ tự mới; vị trí ngoài danh sách thì giữ nguyên
 */
function moveRule(sorting: SortRules, fromIndex: number, toIndex: number): SortRules {
  if (toIndex < 0 || toIndex >= sorting.length || fromIndex === toIndex) return sorting;
  const reordered = [...sorting];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved!);
  return reordered;
}

/**
 * Bảng nổi Sắp xếp.
 * @param props  xem SortPanelProps
 * @returns      danh sách dòng sắp xếp và các nút thêm / xóa
 */
export function SortPanel<Row>({ fields, sorting, onChange, defaultNote }: SortPanelProps<Row>) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const usedKeys = sorting.map((rule) => rule.id);
  const unusedField = fields.find((field) => !usedKeys.includes(field.key));

  // Thay một dòng bằng dòng mới (đổi cột hoặc đổi chiều)
  const replaceRule = (index: number, rule: SortRules[number]) =>
    onChange(sorting.map((current, i) => (i === index ? rule : current)));

  // Bắt đầu kéo: chỉ kéo được khi nắm vào phần trống của dòng, không phải ô chọn hay nút
  const startDrag = (event: DragEvent<HTMLDivElement>, index: number) => {
    if ((event.target as HTMLElement).closest('select,button')) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDrag({ fromIndex: index, overIndex: null, overHalf: 'top' });
  };

  // Rê qua một dòng: ghi nhớ nửa trên hay nửa dưới để vẽ vạch chỗ thả
  const dragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (!drag) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    const overHalf = event.clientY < box.top + box.height / 2 ? 'top' : 'bottom';
    if (drag.overIndex !== index || drag.overHalf !== overHalf) setDrag({ ...drag, overIndex: index, overHalf });
  };

  // Thả: tính vị trí mới (thả ở nửa dưới = đứng sau dòng đó)
  const drop = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (!drag) return;
    event.preventDefault();
    let toIndex = drag.overHalf === 'bottom' ? index + 1 : index;
    if (toIndex > drag.fromIndex) toIndex--;
    onChange(moveRule(sorting, drag.fromIndex, toIndex));
    setDrag(null);
  };

  return (
    <>
      <p className={styles.popTitle}>Sắp xếp theo</p>

      {sorting.length ? (
        sorting.map((rule, index) => {
          const field = fields.find((candidate) => candidate.key === rule.id);
          if (!field) return null;
          const [ascendingLabel, descendingLabel] = SORT_DIRECTION_LABELS[field.type];
          const dropMark =
            drag?.overIndex === index ? (drag.overHalf === 'top' ? styles.dropAbove : styles.dropBelow) : '';
          return (
            <div
              key={rule.id}
              className={`${styles.popRow} ${drag?.fromIndex === index ? styles.dragging : ''} ${dropMark}`}
              draggable
              onDragStart={(event) => startDrag(event, index)}
              onDragOver={(event) => dragOver(event, index)}
              onDrop={(event) => drop(event, index)}
              onDragEnd={() => setDrag(null)}
            >
              <span className={styles.grip} title="Kéo để đổi thứ tự ưu tiên" aria-hidden="true">
                ⋮⋮
              </span>
              <span className={styles.priority}>{index + 1}</span>
              <select
                aria-label="Cột"
                value={rule.id}
                onChange={(event) => replaceRule(index, { ...rule, id: event.target.value })}
              >
                {fields
                  .filter((candidate) => candidate.key === rule.id || !usedKeys.includes(candidate.key))
                  .map((candidate) => (
                    <option key={candidate.key} value={candidate.key}>
                      {candidate.label}
                    </option>
                  ))}
              </select>
              <select
                aria-label="Thứ tự"
                value={rule.desc ? 'desc' : 'asc'}
                onChange={(event) => replaceRule(index, { ...rule, desc: event.target.value === 'desc' })}
              >
                <option value="asc">{ascendingLabel}</option>
                <option value="desc">{descendingLabel}</option>
              </select>
              <span className={styles.moveButtons}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Ưu tiên cao hơn"
                  disabled={index === 0}
                  onClick={() => onChange(moveRule(sorting, index, index - 1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Ưu tiên thấp hơn"
                  disabled={index === sorting.length - 1}
                  onClick={() => onChange(moveRule(sorting, index, index + 1))}
                >
                  ↓
                </button>
              </span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Bỏ dòng sắp xếp"
                onClick={() => onChange(sorting.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </div>
          );
        })
      ) : (
        <p className={styles.emptyNote}>Chưa sắp xếp. {defaultNote}</p>
      )}

      {sorting.length > 1 && (
        <p className={styles.emptyNote}>Dòng trên được ưu tiên trước. Kéo ⋮⋮ hoặc bấm ↑ ↓ để đổi thứ tự.</p>
      )}

      <div className={styles.popFoot}>
        {unusedField ? (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => onChange([...sorting, { id: unusedField.key, desc: false }])}
          >
            + Thêm sắp xếp
          </button>
        ) : (
          <span />
        )}
        {sorting.length > 0 && (
          <button type="button" className={`${styles.linkButton} ${styles.linkMuted}`} onClick={() => onChange([])}>
            Xóa tất cả
          </button>
        )}
      </div>
    </>
  );
}
