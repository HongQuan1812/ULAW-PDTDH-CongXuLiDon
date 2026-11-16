/* Hook gọi API Sao lưu (chỉ vai trò có quyền manageBackups): tổng quan, nơi lưu, lịch, sao lưu ngay, tải về. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  backupRunFilePath,
  backupTargetPath,
  connectGoogleDrivePath,
  type BackupRun,
  type BackupSchedule,
  type BackupTarget,
  type BackupTargetInput,
  type BackupsResponse,
  type ConnectGoogleDriveResponse,
} from '@ulaw/shared';
import { apiFetch, fetchFile, type DownloadedFile } from './client';

/** Khóa lưu tạm tổng quan sao lưu trong TanStack Query. */
export const BACKUPS_KEY = ['backups'] as const;

/** Đang có bản sao lưu chạy thì tải lại sau chừng này mili giây để thấy lúc xong. */
const RUNNING_REFETCH_MS = 3000;

/**
 * Tổng quan trang Sao lưu; đang có bản chạy thì tự tải lại tới khi xong.
 * @returns  kết quả useQuery; data = { targets, schedule, nextScheduledAt, lastSuccessAt, running, runs… }
 */
export function useBackups() {
  return useQuery({
    queryKey: BACKUPS_KEY,
    queryFn: () => apiFetch<BackupsResponse>(ENDPOINTS.backups.overview),
    refetchInterval: (query) => (query.state.data?.running ? RUNNING_REFETCH_MS : false),
  });
}

/**
 * Hàm dùng chung cho các lệnh của trang: xong thì tải lại tổng quan.
 * @param mutationFn  lệnh gọi API
 * @returns           kết quả useMutation
 */
function useBackupMutation<Input, Output>(mutationFn: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }) });
}

/**
 * Thêm hoặc sửa nơi lưu.
 * @returns  kết quả useMutation; gọi mutateAsync({ input, targetId? }) → nơi lưu sau khi lưu (không có targetId = thêm mới)
 */
export function useSaveBackupTarget() {
  return useBackupMutation(({ input, targetId }: { input: BackupTargetInput; targetId?: string }) =>
    apiFetch<BackupTarget>(targetId ? backupTargetPath(targetId) : ENDPOINTS.backups.targets, {
      method: targetId ? 'PUT' : 'POST',
      body: JSON.stringify(input),
    }),
  );
}

/**
 * Bỏ một nơi lưu.
 * @returns  kết quả useMutation; gọi mutateAsync(targetId)
 */
export function useRemoveBackupTarget() {
  return useBackupMutation((targetId: string) => apiFetch<void>(backupTargetPath(targetId), { method: 'DELETE' }));
}

/**
 * Lấy đường dẫn sang Google để kết nối Drive cho một nơi lưu (giao diện chuyển trang sang đó).
 * @returns  kết quả useMutation; gọi mutateAsync(targetId) → { url }
 */
export function useConnectGoogleDrive() {
  return useMutation({
    mutationFn: (targetId: string) => apiFetch<ConnectGoogleDriveResponse>(connectGoogleDrivePath(targetId), { method: 'POST' }),
  });
}

/**
 * Lưu lịch định kì. Lưu xong thì thay tổng quan bằng bản máy chủ trả về.
 * @returns  kết quả useMutation; gọi mutateAsync(schedule) → tổng quan
 */
export function useSaveBackupSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: BackupSchedule) =>
      apiFetch<BackupsResponse>(ENDPOINTS.backups.schedule, { method: 'PUT', body: JSON.stringify(schedule) }),
    onSuccess: (response) => queryClient.setQueryData(BACKUPS_KEY, response),
  });
}

/**
 * Sao lưu ngay vào một nơi lưu (chạy nền; tổng quan tự tải lại tới khi xong).
 * @returns  kết quả useMutation; gọi mutateAsync(targetId) → lần sao lưu vừa bắt đầu
 */
export function useRunBackup() {
  return useBackupMutation((targetId: string) =>
    apiFetch<BackupRun>(ENDPOINTS.backups.run, { method: 'POST', body: JSON.stringify({ targetId }) }),
  );
}

/**
 * Sao lưu rồi tải thẳng về máy.
 * @returns  kết quả useMutation; gọi mutateAsync() → tệp .tar.gz
 */
export function useDownloadBackup() {
  return useBackupMutation((_: void) => fetchFile(ENDPOINTS.backups.download, { method: 'POST' }));
}

/**
 * Tải về một bản đã lưu ở thư mục trên máy chủ.
 * @param runId  id lần sao lưu
 * @returns      tệp .tar.gz
 */
export function fetchBackupFile(runId: string): Promise<DownloadedFile> {
  return fetchFile(backupRunFilePath(runId));
}
