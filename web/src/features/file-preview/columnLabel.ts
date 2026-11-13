/* Tên cột kiểu bảng tính: A, B, … Z, AA, AB, … */

/**
 * Tên cột theo thứ tự, như tiêu đề cột trong Excel.
 * @param columnIndex  vị trí cột, tính từ 0 (0 = A)
 * @returns            tên cột, vd 0 → 'A', 26 → 'AA'
 */
export function columnLabel(columnIndex: number): string {
  let label = '';
  let remaining = columnIndex + 1;
  while (remaining > 0) {
    const letterIndex = (remaining - 1) % 26;
    label = String.fromCharCode(65 + letterIndex) + label;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return label;
}
