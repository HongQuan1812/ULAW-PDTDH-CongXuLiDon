/* HỢP ĐỒNG nhóm API tệp đính kèm: lấy nội dung một tệp đã lưu ở máy chủ (để xem trước, tải về).
   Tải tệp lên đi chung với đơn (form.ts), không có API riêng.
   API giả (MSW), frontend và backend cùng theo file này. */

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const FILE_ENDPOINTS = {
  /** GET → nội dung tệp (không phải JSON): kiểu tệp (Content-Type) theo đuôi tệp, tên tệp trong Content-Disposition.
      Xem được: người nộp đơn chứa tệp, hoặc cán bộ có quyền viewAll. Không có tệp, hoặc không được xem, đều trả 404 */
  content: '/files/:fileId',
} as const;

/**
 * Đường dẫn API lấy nội dung một tệp.
 * @param fileId  id tệp ở máy chủ (FileRef.id), vd 'file-3f2c…'
 * @returns       vd '/files/file-3f2c…'
 */
export function fileContentPath(fileId: string): string {
  return FILE_ENDPOINTS.content.replace(':fileId', encodeURIComponent(fileId));
}

/* ---------- Câu thông báo ---------- */

export const FILE_MESSAGES = {
  /** Gọi API khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
  /** GET /files/:fileId khi không có tệp, hoặc không được xem (404; không nói rõ để không lộ tệp của người khác) */
  notFound: 'Không có tệp này, hoặc bạn không có quyền xem.',
} as const;
