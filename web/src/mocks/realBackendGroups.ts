/* Khi bật backend giả (VITE_USE_MOCK_BACKEND=true): nhóm nào vẫn tới backend thật, nhóm nào do backend giả (MSW) trả lời.
   Tắt backend giả thì danh sách này không dùng tới: mọi nhóm tới backend thật.
   Làm xong nhóm nào ở backend thì thêm tên nhóm đó vào REAL_BACKEND_GROUPS. */

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

/** Các nhóm đã có ở backend: MSW cho request đi tiếp, Vite chuyển sang backend thật. Các nhóm còn lại do backend giả trả lời. */
export const REAL_BACKEND_GROUPS: ReadonlySet<ApiGroup> = new Set<ApiGroup>(['health', 'auth', 'profile', 'accounts', 'form-types', 'files', 'forms', 'form', 'exports', 'form-notes', 'email']);
