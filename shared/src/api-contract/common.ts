/* HỢP ĐỒNG dùng chung cho mọi nhóm API: lỗi, và cách hỏi / trả một trang của bảng danh sách. */
import { z } from 'zod';
import {
  FieldOptionSchema,
  ListFilterSchema,
  type FieldType,
  type ListFilter,
  type ListQuery,
  type ListSortRule,
} from '../aux-schema/lists';

/** Body khi API trả lỗi (4xx, 5xx). */
export const ApiErrorBodySchema = z.object({ message: z.string() });
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

/** Câu thông báo dùng chung cho mọi nhóm API, theo mã HTTP. */
export const COMMON_MESSAGES = {
  /** Danh sách: trang, số dòng mỗi trang, sắp xếp hoặc lọc sai (cột không có, khoảng ở cột chữ…) (422) */
  listQuery: 'Điều kiện tìm, lọc hoặc sắp xếp không hợp lệ.',
  /** Hiện CCCD: thiếu danh sách người, hoặc quá nhiều người một lần (422) */
  userIds: 'Danh sách người cần hiện CCCD không hợp lệ.',
  /** Lỗi bất ngờ ở máy chủ (mất kết nối CSDL, lỗi chưa lường trước…) */
  500: 'Máy chủ đang gặp sự cố, chưa làm được việc này. Hãy thử lại sau ít phút.',
} as const;

/* ---------- Bảng danh sách: hỏi một trang ----------
   GET <danh sách>?page=2&pageSize=8&search=nguyen&sort=submittedAt:desc,code:asc&filters=[{"fieldKey":"status","operator":"equals","value":"xet"}]
   - page: đếm từ 1, mặc định 1 · pageSize: 1 đến LIST_PAGE_SIZE_MAX, mặc định 20
   - search: chữ trong ô tìm kiếm, tìm trên chữ hiện trong ô (không phân biệt hoa thường, dấu)
   - sort: các dòng "cột:asc|desc" cách nhau bởi dấu phẩy; bỏ trống = thứ tự mặc định của bảng
   - filters: mảng điều kiện lọc dạng JSON (ListFilter); các điều kiện cộng dồn
   Cột không có trong bảng, hoặc lọc "Trong khoảng" ở cột không phải số / ngày thì 422 (COMMON_MESSAGES.listQuery). */

/** Số dòng mỗi trang lớn nhất máy chủ chịu trả. */
export const LIST_PAGE_SIZE_MAX = 100;

/** Số dòng mỗi trang khi không gửi pageSize. */
const LIST_PAGE_SIZE_DEFAULT = 20;

/**
 * Phần chung của mọi trang danh sách máy chủ trả về; mỗi nhóm thêm mảng dòng của mình (forms, accounts…).
 * total: số dòng khớp tìm kiếm và bộ lọc (tất cả các trang) · page: trang thật sự trả về (hỏi quá trang cuối thì là trang cuối)
 * filterOptions: lựa chọn lọc của các cột select không có lựa chọn cố định, lấy trên mọi dòng người xem được thấy
 */
export const ListPageMetaSchema = z.object({
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  filterOptions: z.record(z.string(), z.array(FieldOptionSchema)),
});
export type ListPageMeta = z.infer<typeof ListPageMetaSchema>;

/**
 * Ghi một lần hỏi trang thành các tham số trên đường dẫn (trình duyệt gọi). Bỏ các tham số trống cho đường dẫn gọn.
 * @param listQuery  trang, số dòng, chữ tìm, sắp xếp, lọc
 * @returns          tham số, vd { page: '2', pageSize: '8', sort: 'submittedAt:desc' }
 */
export function listQueryParams(listQuery: ListQuery): Record<string, string> {
  const params: Record<string, string> = { page: String(listQuery.page), pageSize: String(listQuery.pageSize) };
  const search = listQuery.search.trim();
  if (search) params.search = search;
  if (listQuery.sort.length) params.sort = listQuery.sort.map((rule) => `${rule.id}:${rule.desc ? 'desc' : 'asc'}`).join(',');
  if (listQuery.filters.length) params.filters = JSON.stringify(listQuery.filters);
  return params;
}

/**
 * Đọc chuỗi số nguyên dương trong khoảng cho trước.
 * @param text      chữ trên đường dẫn; undefined = không gửi
 * @param fallback  giá trị khi không gửi
 * @param max       lớn nhất được nhận
 * @returns         số đã đọc; sai dạng hoặc ngoài khoảng 1..max thì null
 */
function readPositiveInteger(text: string | undefined, fallback: number, max: number): number | null {
  if (text === undefined || text === '') return fallback;
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return number >= 1 && number <= max ? number : null;
}

/**
 * Đọc tham số sort, vd "submittedAt:desc,code:asc".
 * @param text       chữ trên đường dẫn; undefined = không gửi
 * @param fieldKeys  các cột của bảng
 * @returns          các dòng sắp xếp; sai dạng, cột không có hoặc một cột hai lần thì null
 */
function readSort(text: string | undefined, fieldKeys: ReadonlySet<string>): ListSortRule[] | null {
  if (!text) return [];
  const sort = text.split(',').map((part) => {
    const [id = '', direction] = part.split(':');
    return fieldKeys.has(id) && (direction === 'asc' || direction === 'desc') ? { id, desc: direction === 'desc' } : null;
  });
  if (sort.some((rule) => rule === null)) return null;
  const ids = sort.map((rule) => rule!.id);
  return new Set(ids).size === ids.length ? (sort as ListSortRule[]) : null;
}

/**
 * Đọc tham số filters (mảng JSON).
 * @param text        chữ trên đường dẫn; undefined = không gửi
 * @param fieldTypes  kiểu của từng cột trong bảng
 * @returns           các điều kiện lọc; sai dạng, cột không có hoặc lọc khoảng ở cột không phải số / ngày thì null
 */
function readFilters(text: string | undefined, fieldTypes: ReadonlyMap<string, FieldType>): ListFilter[] | null {
  if (!text) return [];

  // Phải là JSON mảng các điều kiện đúng dạng
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = z.array(ListFilterSchema).safeParse(json);
  if (!parsed.success) return null;

  // Cột phải có trong bảng; "Trong khoảng" chỉ cho cột số, ngày
  const isValid = parsed.data.every((filter) => {
    const type = fieldTypes.get(filter.fieldKey);
    if (!type) return false;
    return filter.operator === 'equals' || type === 'number' || type === 'date' || type === 'datetime';
  });
  return isValid ? parsed.data : null;
}

/**
 * Đọc một lần hỏi trang từ tham số trên đường dẫn (máy chủ gọi).
 * @param params  tham số trên đường dẫn, vd Object.fromEntries(url.searchParams)
 * @param fields  các cột của bảng (tên và kiểu), để kiểm tra cột được sắp xếp, lọc
 * @returns       lần hỏi trang đã đọc; sai thì null (máy chủ trả 422 COMMON_MESSAGES.listQuery)
 */
export function parseListQuery(
  params: Readonly<Record<string, string | undefined>>,
  fields: readonly { key: string; type: FieldType }[],
): ListQuery | null {
  const fieldTypes = new Map(fields.map((field) => [field.key, field.type]));

  // Đọc từng tham số; tham số nào sai thì cả lần hỏi sai
  const page = readPositiveInteger(params.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = readPositiveInteger(params.pageSize, LIST_PAGE_SIZE_DEFAULT, LIST_PAGE_SIZE_MAX);
  const sort = readSort(params.sort, new Set(fieldTypes.keys()));
  const filters = readFilters(params.filters, fieldTypes);
  if (page === null || pageSize === null || sort === null || filters === null) return null;

  return { page, pageSize, search: params.search ?? '', sort, filters };
}

/* ---------- Hiện CCCD của các dòng đang xem ----------
   GET <…>/cccds?userIds=sv-1,sv-2: chỉ trả CCCD của những người đang có trên trang bảng, không phải của mọi người. */

/** Số người nhiều nhất một lần hỏi CCCD (bằng số dòng lớn nhất của một trang). */
export const USER_IDS_MAX = LIST_PAGE_SIZE_MAX;

/**
 * Ghi danh sách người cần hiện CCCD thành tham số trên đường dẫn (trình duyệt gọi).
 * @param userIds  id những người đang có trên trang bảng
 * @returns        tham số, vd { userIds: 'sv-1,sv-2' }
 */
export function userIdsParams(userIds: readonly string[]): Record<string, string> {
  return { userIds: userIds.join(',') };
}

/**
 * Đọc danh sách người cần hiện CCCD (máy chủ gọi).
 * @param text  tham số userIds trên đường dẫn
 * @returns     các id, bỏ trùng; trống hoặc quá USER_IDS_MAX người thì null (máy chủ trả 422 COMMON_MESSAGES.userIds)
 */
export function parseUserIdsParam(text: string | undefined): string[] | null {
  const userIds = [...new Set((text ?? '').split(',').filter(Boolean))];
  return userIds.length && userIds.length <= USER_IDS_MAX ? userIds : null;
}
