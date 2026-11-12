/* Tìm kiếm, lọc, sắp xếp, chia trang một bảng danh sách.
   Máy chủ (API giả và backend) dùng applyListQuery() để trả một trang; trình duyệt dùng các hàm nhỏ để hiện ô,
   lấy lựa chọn lọc (bảng còn tải hết một lượt, vd Quản lí loại đơn). Chỉ có hàm thuần, không có giao diện. */
import type { FieldOption, FieldType, ListFilter, ListQuery, ListSortRule } from '../aux-schema/lists';
import { formatDate, formatDateTime, normalizeText } from './lists--display-text';

/* ---------- Khai báo cột ---------- */

/** Một cột của bảng. */
export interface TableField<Row> {
  /** Tên cột trong code, vd 'status'; cũng là tên cột khi gửi sắp xếp, lọc lên máy chủ */
  key: string;
  /** Tên cột hiện trên tiêu đề và trong bảng Sắp xếp / Lọc, vd 'Trạng thái' */
  label: string;
  type: FieldType;
  /** Giá trị thô để lọc, sắp xếp: chuỗi (ngày dạng 'YYYY-MM-DD…'), số; null = ô trống */
  getValue: (row: Row) => string | number | null;
  /** Chỉ cột select: tên hiển thị của giá trị trong dòng, vd 'xet' → 'Đang xét' */
  getLabel?: (row: Row) => string;
  /** Chỉ cột select: các lựa chọn cố định khi lọc. Không có thì lấy từ dữ liệu (máy chủ gửi kèm trang, xem filterOptionsOf) */
  options?: readonly FieldOption[];
  /** Chỉ cột select: thứ tự khi sắp xếp tăng dần (số nhỏ trước), vd Đang mở → Nháp → Đã đóng. Không có thì xếp theo tên hiển thị */
  getOrder?: (row: Row) => number;
}

/**
 * Chữ hiện trong ô của một cột. Tìm kiếm chỉ tìm trong chữ này (đúng như người dùng thấy).
 * @param field  cột
 * @param row    dòng dữ liệu
 * @returns      chữ hiện trong ô; ô trống thì ""
 */
export function displayText<Row>(field: TableField<Row>, row: Row): string {
  const value = field.getValue(row);
  if (value === null || value === '') return '';
  if (field.type === 'select') return field.getLabel?.(row) ?? String(value);
  if (field.type === 'date') return formatDate(String(value));
  if (field.type === 'datetime') return formatDateTime(String(value));
  return String(value);
}

/**
 * Các lựa chọn để lọc một cột select: lựa chọn cố định, hoặc các giá trị khác nhau đang có trong dữ liệu.
 * @param field  cột select
 * @param rows   toàn bộ dữ liệu của bảng
 * @returns      danh sách lựa chọn
 */
export function selectOptions<Row>(field: TableField<Row>, rows: readonly Row[]): FieldOption[] {
  if (field.options) return [...field.options];
  const labelsByValue = new Map<string, string>();
  rows.forEach((row) => {
    const value = field.getValue(row);
    if (value !== null && value !== '' && !labelsByValue.has(String(value))) {
      labelsByValue.set(String(value), displayText(field, row));
    }
  });
  return [...labelsByValue].map(([value, label]) => ({ value, label }));
}

/**
 * Lựa chọn lọc của các cột select không có lựa chọn cố định (vd Loại đơn, Người xử lí), lấy từ dữ liệu.
 * @param fields  các cột của bảng
 * @param rows    toàn bộ dữ liệu người xem được thấy (chưa tìm, lọc), để lựa chọn không đổi theo bộ lọc đang chọn
 * @returns       lựa chọn theo tên cột, vd { formType: [{ value: 'xmm', label: 'Xét miễn môn' }] }
 */
export function filterOptionsOf<Row>(fields: readonly TableField<Row>[], rows: readonly Row[]): Record<string, FieldOption[]> {
  return Object.fromEntries(
    fields.filter((field) => field.type === 'select' && !field.options).map((field) => [field.key, selectOptions(field, rows)]),
  );
}

/* ---------- Sắp xếp ---------- */

/**
 * So sánh hai dòng theo một cột (tăng dần). Ô trống không qua hàm này (luôn xếp cuối).
 * Cột select so theo thứ tự riêng (getOrder) nếu có, không thì theo tên hiển thị; cột số so theo số; còn lại so chữ kiểu tiếng Việt, số trong chữ so theo giá trị.
 * @param field  cột
 * @param rowA   dòng thứ nhất
 * @param rowB   dòng thứ hai
 * @returns      âm nếu rowA đứng trước, dương nếu đứng sau, 0 nếu bằng nhau
 */
export function compareRows<Row>(field: TableField<Row>, rowA: Row, rowB: Row): number {
  if (field.type === 'number') return Number(field.getValue(rowA)) - Number(field.getValue(rowB));
  if (field.type === 'select' && field.getOrder) return field.getOrder(rowA) - field.getOrder(rowB);
  const textA = field.type === 'select' ? displayText(field, rowA) : String(field.getValue(rowA));
  const textB = field.type === 'select' ? displayText(field, rowB) : String(field.getValue(rowB));
  return textA.localeCompare(textB, 'vi', { numeric: true, sensitivity: 'base' });
}

/**
 * Sắp xếp theo nhiều cột: cột đầu ưu tiên nhất, bằng nhau thì xét cột sau; ô trống luôn nằm cuối dù xếp chiều nào.
 * Bằng nhau ở mọi cột thì giữ thứ tự cũ.
 * @param rows     các dòng
 * @param fields   các cột của bảng (dòng sắp xếp theo cột không có thì bỏ qua)
 * @param sorting  các dòng sắp xếp
 * @returns        mảng mới đã sắp xếp
 */
export function sortRows<Row>(rows: readonly Row[], fields: readonly TableField<Row>[], sorting: readonly ListSortRule[]): Row[] {
  const sortFields = sorting.flatMap((rule) => {
    const field = fields.find((candidate) => candidate.key === rule.id);
    return field ? [{ field, direction: rule.desc ? -1 : 1 }] : [];
  });
  const isEmpty = (value: string | number | null) => value === null || value === '';

  return [...rows].sort((rowA, rowB) => {
    for (const { field, direction } of sortFields) {
      const emptyA = isEmpty(field.getValue(rowA));
      const emptyB = isEmpty(field.getValue(rowB));
      if (emptyA || emptyB) {
        if (emptyA !== emptyB) return emptyA ? 1 : -1;
        continue;
      }
      const order = compareRows(field, rowA, rowB) * direction;
      if (order !== 0) return order;
    }
    return 0;
  });
}

/* ---------- Lọc ---------- */

/**
 * Điều kiện lọc đã có giá trị chưa. Điều kiện chưa có giá trị thì không lọc gì và không được đếm.
 * @param filter  điều kiện lọc
 * @returns       true nếu đang có tác dụng
 */
export function isFilterActive(filter: ListFilter): boolean {
  return filter.operator === 'range' ? Boolean(filter.from || filter.to) : filter.value !== '';
}

/**
 * Một dòng có thỏa một điều kiện lọc không. Ô trống không thỏa điều kiện nào.
 * Chữ so khớp nguyên ô, không phân biệt hoa thường và dấu; ngày so theo ngày (bỏ giờ).
 * @param field   cột của điều kiện
 * @param filter  điều kiện lọc (đã có tác dụng)
 * @param row     dòng dữ liệu
 * @returns       true nếu thỏa
 */
function matchesFilter<Row>(field: TableField<Row>, filter: ListFilter, row: Row): boolean {
  const rawValue = field.getValue(row);
  if (rawValue === null || rawValue === '') return false;

  // Lựa chọn và chữ: phải bằng
  if (field.type === 'select') return String(rawValue) === filter.value;
  if (field.type === 'text') return normalizeText(String(rawValue)) === normalizeText(filter.value.trim());

  // Số: bằng, hoặc trong khoảng
  if (field.type === 'number') {
    const number = Number(rawValue);
    if (filter.operator === 'equals') return number === Number(filter.value);
    return (filter.from === '' || number >= Number(filter.from)) && (filter.to === '' || number <= Number(filter.to));
  }

  // Ngày: so phần 'YYYY-MM-DD' như chuỗi
  const day = String(rawValue).slice(0, 10);
  if (filter.operator === 'equals') return day === filter.value;
  return (!filter.from || day >= filter.from) && (!filter.to || day <= filter.to);
}

/**
 * Lọc dữ liệu theo ô tìm kiếm và các điều kiện lọc.
 * @param rows             toàn bộ dữ liệu
 * @param fields           các cột của bảng
 * @param search           chữ trong ô tìm kiếm: dòng có ít nhất một ô chứa chữ này (không phân biệt dấu)
 * @param filters          các điều kiện lọc: dòng phải thỏa tất cả điều kiện đang có tác dụng
 * @param extraSearchText  tùy chọn: chữ không hiện trong ô nhưng vẫn tìm được, vd số CCCD đầy đủ khi người xem có quyền
 * @returns                các dòng còn lại, giữ thứ tự cũ
 */
export function filterRows<Row>(
  rows: readonly Row[],
  fields: readonly TableField<Row>[],
  search: string,
  filters: readonly ListFilter[],
  extraSearchText?: (row: Row) => readonly string[],
): Row[] {
  const keyword = normalizeText(search.trim());
  const activeFilters = filters.filter(isFilterActive).flatMap((filter) => {
    const field = fields.find((candidate) => candidate.key === filter.fieldKey);
    return field ? [{ field, filter }] : [];
  });

  // Dòng khớp ô tìm kiếm: một ô đang hiện, hoặc một chữ thêm, chứa từ khóa
  const matchesSearch = (row: Row) =>
    fields.some((field) => normalizeText(displayText(field, row)).includes(keyword)) ||
    (extraSearchText?.(row) ?? []).some((text) => normalizeText(text).includes(keyword));

  return rows.filter(
    (row) => (!keyword || matchesSearch(row)) && activeFilters.every(({ field, filter }) => matchesFilter(field, filter, row)),
  );
}

/* ---------- Một trang ---------- */

/** Một trang của bảng, máy chủ trả về. */
export interface ListPageResult<Row> {
  /** Các dòng của trang */
  rows: Row[];
  /** Số dòng khớp tìm kiếm và bộ lọc (tất cả các trang) */
  total: number;
  /** Trang thật sự trả về, đếm từ 1: hỏi quá trang cuối thì là trang cuối */
  page: number;
  /** Lựa chọn lọc của các cột select không có lựa chọn cố định */
  filterOptions: Record<string, FieldOption[]>;
}

/**
 * Tìm, lọc, sắp xếp rồi lấy một trang (máy chủ gọi khi trả danh sách).
 * @param rows            mọi dòng người xem được thấy
 * @param fields          các cột của bảng
 * @param listQuery       trang, số dòng mỗi trang, chữ tìm, sắp xếp, lọc
 * @param defaultSorting  thứ tự khi người dùng chưa chọn sắp xếp
 * @param extraSearchText tùy chọn: chữ tìm được dù không hiện (xem filterRows)
 * @returns               các dòng của trang, tổng số dòng khớp, trang thật sự, lựa chọn lọc
 */
export function applyListQuery<Row>(
  rows: readonly Row[],
  fields: readonly TableField<Row>[],
  listQuery: ListQuery,
  defaultSorting: readonly ListSortRule[],
  extraSearchText?: (row: Row) => readonly string[],
): ListPageResult<Row> {
  // Tìm, lọc, rồi sắp xếp (chưa chọn thì theo thứ tự mặc định)
  const matchedRows = filterRows(rows, fields, listQuery.search, listQuery.filters, extraSearchText);
  const sortedRows = sortRows(matchedRows, fields, listQuery.sort.length ? listQuery.sort : defaultSorting);

  // Hỏi quá trang cuối (vd vừa có đơn bị lọc ra) thì trả trang cuối
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / listQuery.pageSize));
  const page = Math.min(listQuery.page, pageCount);
  const start = (page - 1) * listQuery.pageSize;

  return {
    rows: sortedRows.slice(start, start + listQuery.pageSize),
    total: sortedRows.length,
    page,
    filterOptions: filterOptionsOf(fields, rows),
  };
}
