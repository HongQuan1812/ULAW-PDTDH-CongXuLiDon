/* Hook gọi API tệp đính kèm. */
import { useQuery } from '@tanstack/react-query';
import { FILE_MESSAGES, fileContentPath } from '@ulaw/shared';
import { ApiError } from './client';

/**
 * Tải nội dung một tệp đã lưu ở máy chủ.
 * @param fileId  id tệp ở máy chủ
 * @returns       nội dung tệp; lỗi HTTP thì ném ApiError (câu báo lấy từ body.message nếu có)
 */
async function fetchFileContent(fileId: string): Promise<Blob> {
  const response = await fetch(`/api${fileContentPath(fileId)}`, { credentials: 'include' });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { message?: string } | undefined;
    throw new ApiError(response.status, body?.message ?? FILE_MESSAGES.notFound, body);
  }
  return response.blob();
}

/**
 * Nội dung một tệp đã lưu ở máy chủ, để xem trước. Chỉ tải khi hộp xem trước đang mở.
 * @param fileId   id tệp ở máy chủ
 * @param enabled  true: tải (hộp xem trước đang mở); false: chưa tải
 * @returns        kết quả useQuery; data = nội dung tệp (Blob)
 */
export function useFileContent(fileId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['files', 'content', fileId] as const,
    queryFn: () => fetchFileContent(fileId),
    enabled,
    gcTime: 0, // không giữ nội dung tệp (có thể lớn) sau khi đóng hộp xem trước
  });
}
