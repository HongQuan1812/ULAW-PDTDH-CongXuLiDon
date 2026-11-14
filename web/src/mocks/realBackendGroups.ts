/* Khi bật backend giả (VITE_USE_MOCK_BACKEND=true): nhóm nào vẫn tới backend thật, nhóm nào do backend giả (MSW) trả lời.
   Tắt backend giả thì danh sách này không dùng tới: mọi nhóm tới backend thật.
   Danh sách đặt ở VITE_REAL_BACKEND_GROUPS trong web/.env (mỗi máy đặt riêng). */

/** Các nhóm API, trùng tên tệp trong shared/src/api-contract/ và mocks/handlers/. */
export const API_GROUPS = [
  'accounts',
  'auth',
  'email',
  'exports',
  'files',
  'form-notes',
  'form-types',
  'form',
  'forms',
  'health',
  'profile',
] as const;
export type ApiGroup = (typeof API_GROUPS)[number];

/**
 * Đọc danh sách nhóm tới backend thật.
 * @param value  giá trị VITE_REAL_BACKEND_GROUPS, các tên nhóm cách nhau bằng dấu phẩy, vd "health, auth"; bỏ trống = không nhóm nào
 * @returns      tập tên nhóm
 * @throws       khi có tên không nằm trong API_GROUPS (gõ sai tên)
 */
export function parseRealBackendGroups(value: string | undefined): ReadonlySet<ApiGroup> {
  const names = (value ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  const unknown = names.filter((name) => !(API_GROUPS as readonly string[]).includes(name));
  if (unknown.length > 0) {
    throw new Error(`VITE_REAL_BACKEND_GROUPS (web/.env) có nhóm không tồn tại: ${unknown.join(', ')}. Chỉ nhận: ${API_GROUPS.join(', ')}`);
  }
  return new Set(names as ApiGroup[]);
}

/** Các nhóm tới backend thật khi bật backend giả: MSW cho request đi tiếp, Vite chuyển sang backend. Các nhóm còn lại do backend giả trả lời. */
export const REAL_BACKEND_GROUPS = parseRealBackendGroups(import.meta.env.VITE_REAL_BACKEND_GROUPS);
