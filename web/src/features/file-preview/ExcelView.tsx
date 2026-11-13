/* Xem Excel (.xlsx): giống Excel / Google Sheets: tiêu đề cột A, B, C, số dòng bên trái, thẻ sheet ở đáy.
   Bản xem là gần đúng: có chữ trong ô và ô gộp, không giữ màu, công thức; file lớn bị cắt bớt. */
import { useEffect, useState } from 'react';
import { columnLabel } from './columnLabel';
import { MAX_PREVIEW_COLUMNS, MAX_PREVIEW_ROWS, readWorkbookSheets, type PreviewMerge, type PreviewSheet } from './readWorkbookSheets';
import { PreviewMessage } from './PreviewMessage';
import styles from './FilePreview.module.css';

/**
 * Tra cứu ô gộp: ô trên cùng bên trái giữ chỗ cho cả vùng, các ô còn lại trong vùng không vẽ.
 * @param merges  các vùng gộp của sheet
 * @returns       vùng gộp theo vị trí "hàng,cột" của ô chính, và tập vị trí các ô bị phủ
 */
function indexMerges(merges: readonly PreviewMerge[]): { masters: Map<string, PreviewMerge>; covered: Set<string> } {
  const masters = new Map<string, PreviewMerge>();
  const covered = new Set<string>();
  for (const merge of merges) {
    masters.set(`${merge.row},${merge.column}`, merge);
    for (let row = merge.row; row < merge.row + merge.rowSpan; row++) {
      for (let column = merge.column; column < merge.column + merge.columnSpan; column++) {
        if (row !== merge.row || column !== merge.column) covered.add(`${row},${column}`);
      }
    }
  }
  return { masters, covered };
}

/**
 * @param blob  nội dung tệp .xlsx
 * @returns     thẻ chọn sheet và bảng của sheet đang chọn; đang mở thì có chữ chờ; hỏng thì có câu báo
 */
export function ExcelView({ blob }: { blob: Blob }) {
  const [sheets, setSheets] = useState<PreviewSheet[] | null>(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /** Đọc các sheet của file; hỏng thì báo lỗi. */
    async function load() {
      try {
        const loadedSheets = await readWorkbookSheets(await blob.arrayBuffer());
        if (!cancelled) setSheets(loadedSheets);
      } catch {
        if (!cancelled) setHasError(true);
      }
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (hasError) {
    return <PreviewMessage title="Không xem trước được file này">Tải file về máy để mở bằng Excel.</PreviewMessage>;
  }
  if (!sheets) return <PreviewMessage>Đang mở file Excel…</PreviewMessage>;
  if (sheets.length === 0) return <PreviewMessage title="File không có sheet nào" />;

  const sheet = sheets[selectedSheetIndex] ?? sheets[0]!;
  const columnCount = sheet.rows[0]?.length ?? 0;
  const { masters, covered } = indexMerges(sheet.merges);
  return (
    <div className={styles.excel}>
      <div className={styles.sheetScroll}>
        {sheet.rows.length === 0 ? (
          <p className={styles.sheetEmpty}>Sheet này không có dữ liệu.</p>
        ) : (
          <table className={styles.sheetTable}>
            <thead>
              <tr>
                <th className={styles.sheetCorner} aria-hidden="true" />
                {Array.from({ length: columnCount }, (_, columnIndex) => (
                  <th key={columnIndex} scope="col" className={styles.sheetColumnHead}>
                    {columnLabel(columnIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th scope="row" className={styles.sheetRowHead}>
                    {rowIndex + 1}
                  </th>
                  {row.map((cellText, columnIndex) => {
                    const cellKey = `${rowIndex},${columnIndex}`;
                    if (covered.has(cellKey)) return null;
                    const merge = masters.get(cellKey);
                    return (
                      <td key={columnIndex} rowSpan={merge?.rowSpan} colSpan={merge?.columnSpan}>
                        {cellText}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className={styles.sheetBar}>
        <div className={styles.sheetTabs} role="tablist" aria-label="Các sheet">
          {sheets.map((tabSheet, index) => (
            <button
              key={tabSheet.name}
              type="button"
              role="tab"
              aria-selected={index === selectedSheetIndex}
              className={styles.sheetTab}
              onClick={() => setSelectedSheetIndex(index)}
            >
              {tabSheet.name}
            </button>
          ))}
        </div>
        {sheet.isTruncated && (
          <span className={styles.sheetNote}>
            Chỉ hiện tối đa {MAX_PREVIEW_ROWS} dòng, {MAX_PREVIEW_COLUMNS} cột đầu · tải file về để xem đủ
          </span>
        )}
      </div>
    </div>
  );
}
