/* Gọi API: mọi request đi qua đây. */

/**
 * Lỗi khi API trả mã HTTP không thành công (4xx, 5xx).
 * @param status   mã HTTP, vd 403
 * @param message  câu báo lỗi (lấy từ body.message nếu có)
 * @param body     toàn bộ body lỗi, để đọc thêm chi tiết (vd lỗi từng ô nhập)
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Gọi API và trả về dữ liệu đã đọc từ JSON.
 * @param path  đường dẫn sau /api, vd "/forms"
 * @param init  tùy chọn của fetch (method, body, headers…)
 * @returns     dữ liệu trả về; lỗi HTTP thì ném ApiError để TanStack Query bắt
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Gửi request dạng JSON, kèm cookie phiên đăng nhập
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  // Đọc body (204 thì không có body; body không phải JSON thì bỏ qua)
  const body: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);

  // Lỗi HTTP: ném ApiError, ưu tiên câu báo lỗi từ máy chủ
  if (!res.ok) {
    const message = (body as { message?: string } | undefined)?.message ?? `Lỗi ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  return body as T;
}
