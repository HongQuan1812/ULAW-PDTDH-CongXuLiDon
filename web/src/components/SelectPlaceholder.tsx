/* Dòng "— Chọn —" đứng đầu mọi ô chọn sổ xuống (<select>) của cổng: ô chưa chọn thì ghi chữ này,
   còn mở danh sách ra thì dòng này ẩn đi, chỉ còn các lựa chọn. Mọi <select> dùng chung để giống nhau. */

/**
 * Dòng giữ chỗ của ô chọn.
 * @returns  <option value=""> bị khóa và ẩn khỏi danh sách sổ xuống
 */
export function SelectPlaceholder() {
  return (
    <option value="" disabled hidden>
      — Chọn —
    </option>
  );
}
