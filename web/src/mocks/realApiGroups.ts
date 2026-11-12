/* Chọn nhóm API nào dùng API thật (backend), nhóm nào vẫn dùng API giả.
   Làm xong nhóm nào ở backend thì thêm tên nhóm đó vào REAL_API_GROUPS. */

/** Các nhóm API, trùng tên tệp trong shared/src/api-contract/ và mocks/handlers/. */
export const API_GROUPS = [
  'accounts',
  'auth',
  'email',
  'exports',
  'files',
  'form-types',
  'form',
  'forms',
  'health',
  'profile',
] as const;
export type ApiGroup = (typeof API_GROUPS)[number];

/** Các nhóm đã có ở backend: MSW cho request đi tiếp, Vite chuyển sang backend. Các nhóm còn lại dùng API giả. */
export const REAL_API_GROUPS: ReadonlySet<ApiGroup> = new Set<ApiGroup>(['health', 'auth', 'profile']);
