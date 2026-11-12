/* Ô trả lời bảng nhiều dòng. */
import { useEffect, useRef, type CSSProperties } from 'react';
import { isEmptyCell, isValidTableCell, type TableCell, type TableColumn } from '@ulaw/shared';
import { Button } from '../../components/Button';
import type { AnswerProps } from './answerProps';
import { emptyTableRow, tableTotalText } from './formAnswers';
import { GrowingTextarea } from './GrowingTextarea';
import styles from './FormRenderer.module.css';

/* Độ rộng cột co giãn theo độ dài tên cột (và mô tả nhỏ, lựa chọn dài nhất của cột chọn): tối thiểu 7, tối đa 24 ký tự, cộng 2 ký tự đệm.
   Tên cột dài hơn thì tự xuống dòng; bảng rộng hơn khung thì cuộn ngang. */
const COLUMN_MIN_CHARS = 7;
const COLUMN_MAX_CHARS = 24;

/**
 * Độ rộng một cột, tính bằng số ký tự.
 * @param column  cột của bảng
 * @returns       vd 20 (dùng với đơn vị ch)
 */
function columnWidthChars(column: TableColumn): number {
  // Cột chọn: thêm 3 ký tự cho mũi tên ▾ của ô chọn
  const longestOptionChars = Math.max(0, ...(column.options ?? []).map((option) => option.length + 3));
  const wanted = Math.max(COLUMN_MIN_CHARS, column.label.length, Math.ceil((column.sub ?? '').length * 0.85), longestOptionChars);
  return Math.min(COLUMN_MAX_CHARS, wanted) + 2;
}

/**
 * Đọc câu trả lời thành các dòng, mỗi dòng đủ ô theo số cột (dữ liệu cũ thiếu ô thì thêm ô trống).
 * @param answerValue  câu trả lời đã lưu
 * @param columns      các cột của bảng
 * @returns            các dòng của bảng; câu trả lời không phải bảng thì []
 */
function readRows(answerValue: unknown, columns: readonly TableColumn[]): TableCell[][] {
  if (!Array.isArray(answerValue)) return [];
  const blankRow = emptyTableRow(columns);
  return answerValue
    .filter((row): row is TableCell[] => Array.isArray(row))
    .map((row) => blankRow.map((blankCell, columnIndex) => (row[columnIndex] === undefined ? blankCell : row[columnIndex]!)));
}

/**
 * Ô của bảng có cần tô đỏ không: còn trống, cột số mà không phải số không âm, hoặc cột chọn mà giá trị không có trong danh sách.
 * @param column  cột chứa ô
 * @param cell    giá trị ô
 * @returns       true nếu ô sai
 */
function isInvalidCell(column: TableColumn, cell: TableCell): boolean {
  return isEmptyCell(cell) || !isValidTableCell(column, cell);
}

/**
 * Bảng nhiều dòng: mỗi dòng một bộ ô theo cột; cột số có thể tính tổng ở chân bảng.
 * Sửa được: mỗi ô là một ô nhập (ô chữ dài thì tự xuống hàng, cột chọn là danh sách thả xuống), có nút thêm dòng và xóa dòng. Chỉ xem: bảng chữ.
 * Câu trả lời lưu: mảng các dòng, mỗi dòng một mảng ô theo thứ tự cột (cột số: số hoặc null; cột chọn: lựa chọn, chưa chọn thì "").
 * @returns  bảng và dòng tổng bên dưới
 */
export function TableAnswer({
  question,
  answerValue,
  onAnswerChange,
  readOnly,
  invalid,
  labelId,
  describedBy,
}: AnswerProps<'table'>) {
  const { columns, rowName } = question;
  const rows = readRows(answerValue, columns);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const focusRowIndexRef = useRef<number | null>(null);

  // Vừa thêm dòng: đưa con trỏ vào ô đầu của dòng mới
  useEffect(() => {
    const rowIndex = focusRowIndexRef.current;
    if (rowIndex === null) return;
    focusRowIndexRef.current = null;
    bodyRef.current?.rows[rowIndex]?.querySelector<HTMLElement>('input, textarea, select')?.focus();
  }, [rows.length]);

  /**
   * Đổi giá trị một ô.
   * @param rowIndex     thứ tự dòng
   * @param columnIndex  thứ tự cột
   * @param cell         giá trị mới
   */
  const updateCell = (rowIndex: number, columnIndex: number, cell: TableCell) => {
    onAnswerChange(
      rows.map((row, index) => (index === rowIndex ? row.map((oldCell, k) => (k === columnIndex ? cell : oldCell)) : row)),
    );
  };

  /** Thêm một dòng trống ở cuối bảng. */
  const addRow = () => {
    focusRowIndexRef.current = rows.length;
    onAnswerChange([...rows, emptyTableRow(columns)]);
  };

  /**
   * Xóa một dòng.
   * @param rowIndex  thứ tự dòng cần xóa
   */
  const removeRow = (rowIndex: number) => onAnswerChange(rows.filter((_, index) => index !== rowIndex));

  // Chỉ xem mà chưa có dòng nào
  if (readOnly && !rows.length) return <p className={styles.emptyValue}>Chưa có {rowName} nào.</p>;

  // Độ rộng các cột: STT 52px, các cột theo tên, cột nút xóa 48px (chỉ khi sửa được)
  const columnsWidthChars = columns.reduce((total, column) => total + columnWidthChars(column), 0);
  const tableStyle: CSSProperties = { minWidth: `calc(${readOnly ? 52 : 100}px + ${columnsWidthChars}ch)` };

  return (
    <>
      <div className={styles.tableWrap}>
        <table
          className={`${styles.answerTable} ${readOnly ? styles.answerTableReadOnly : ''}`}
          style={tableStyle}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
        >
          <colgroup>
            <col style={{ width: 52 }} />
            {columns.map((column, columnIndex) => (
              <col key={columnIndex} style={{ width: `${columnWidthChars(column)}ch` }} />
            ))}
            {!readOnly && <col style={{ width: 48 }} />}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">STT</th>
              {columns.map((column, columnIndex) => (
                <th key={columnIndex} scope="col">
                  {column.label}
                  {column.sub && <small>{column.sub}</small>}
                </th>
              ))}
              {!readOnly && (
                <th scope="col">
                  <span className="sr-only">Xóa</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {/* Chưa có dòng nào: một dòng ghi chú thay cho bảng trống */}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className={styles.emptyRow}>
                  Chưa có {rowName} nào. Bấm “+ Thêm {rowName}” để thêm.
                </td>
              </tr>
            )}
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className={styles.rowNumber}>{rowIndex + 1}</td>
                {columns.map((column, columnIndex) => {
                  const cell = row[columnIndex] ?? null;

                  // Chỉ xem: ô chữ
                  if (readOnly) {
                    const text = isEmptyCell(cell) ? '—' : typeof cell === 'number' ? cell.toLocaleString('vi-VN') : cell;
                    return (
                      <td key={columnIndex}>
                        {text}
                      </td>
                    );
                  }

                  // Sửa được: cột số là ô nhập số, cột chọn là danh sách thả xuống, cột chữ là ô tự xuống hàng khi chữ dài;
                  // đang báo lỗi thì tô đỏ ô sai
                  const cellInvalid = invalid && isInvalidCell(column, cell);
                  const cellProps = {
                    placeholder: column.placeholder,
                    'aria-label': `${column.label}, ${rowName} ${rowIndex + 1}`,
                    'aria-invalid': cellInvalid || undefined,
                    className: cellInvalid ? styles.invalid : undefined,
                  };
                  return (
                    <td key={columnIndex}>
                      {column.type === 'select' ? (
                        // Giá trị cũ không còn trong danh sách (người soạn đã sửa lựa chọn) vẫn hiện để người nộp thấy mà chọn lại
                        <select
                          className={`${styles.cellSelect} ${isEmptyCell(cell) ? styles.cellSelectEmpty : ''} ${cellInvalid ? styles.invalid : ''}`}
                          value={typeof cell === 'string' ? cell : ''}
                          onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                          aria-label={cellProps['aria-label']}
                          aria-invalid={cellProps['aria-invalid']}
                        >
                          <option value="">{column.placeholder || '— Chọn —'}</option>
                          {typeof cell === 'string' && cell && !(column.options ?? []).includes(cell) && <option value={cell}>{cell}</option>}
                          {(column.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : column.type === 'number' ? (
                        // Khung bọc cao bằng cả dòng, ô nhập số nằm ở đầu khung để số thẳng hàng với dòng chữ đầu của ô bên cạnh
                        // Bấm vào phần trống bên dưới của khung cũng đưa con trỏ vào ô nhập
                        <div
                          className={`${styles.numberBox} ${cellInvalid ? styles.invalid : ''}`}
                          onClick={(event) => event.currentTarget.querySelector('input')?.focus()}
                        >
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            value={cell ?? ''}
                            onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value === '' ? null : Number(event.target.value))}
                            {...cellProps}
                            className={undefined}
                          />
                        </div>
                      ) : (
                        <GrowingTextarea
                          value={typeof cell === 'string' ? cell : ''}
                          onValueChange={(text) => updateCell(rowIndex, columnIndex, text)}
                          {...cellProps}
                        />
                      )}
                    </td>
                  );
                })}
                {!readOnly && (
                  <td className={styles.rowAction}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Xóa ${rowName} ${rowIndex + 1}`}
                      title={`Xóa ${rowName}`}
                      onClick={() => removeRow(rowIndex)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableFoot}>
        {!readOnly && <Button onClick={addRow}>+ Thêm {rowName}</Button>}
        <p className={styles.tableTotal}>{tableTotalText(question, rows)}</p>
      </div>
    </>
  );
}
