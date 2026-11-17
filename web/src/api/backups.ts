/* Hook gọi API Sao lưu (chỉ vai trò có quyền manageBackups): tổng quan, lịch sử theo trang, nơi lưu, lịch, sao lưu ngay, tải về. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  backupRunFilePath,
  backupSchedulePath,
  backupTargetPath,
  BACKUP_MESSAGES,
  DRIVE_CONNECT_CHANNEL,
  DriveConnectMessageSchema,
  type BackupRun,
  type BackupRunsResponse,
  type BackupSchedule,
  type BackupTarget,
  type BackupTargetInput,
  type BackupsResponse,
  type ConnectGoogleDriveRequest,
  type ConnectGoogleDriveResponse,
  type DrivePickerRequest,
  type DrivePickerResponse,
} from '@ulaw/shared';
import { apiFetch, fetchFile, type DownloadedFile } from './client';
import { listPath, toListPage, type ListSource } from './lists';

/** Khóa lưu tạm tổng quan sao lưu trong TanStack Query; các trang lịch sử nằm dưới khóa này nên làm mới tổng quan là làm mới cả lịch sử. */
export const BACKUPS_KEY = ['backups'] as const;

/** Khóa gốc các trang lịch sử. */
export const BACKUP_RUNS_KEY = [...BACKUPS_KEY, 'runs'] as const;

/** Nguồn của bảng lịch sử (useServerTable): mỗi lần lấy một trang. */
export const BACKUP_RUNS_SOURCE: ListSource<BackupRun> = {
  queryKey: BACKUP_RUNS_KEY,
  fetchPage: async (listQuery) => {
    const { runs, ...pageMeta } = await apiFetch<BackupRunsResponse>(listPath(ENDPOINTS.backups.runs, listQuery));
    return toListPage(runs, pageMeta);
  },
};

/** Đang có bản sao lưu chạy thì tải lại sau chừng này mili giây để thấy lúc xong. */
const RUNNING_REFETCH_MS = 3000;

/**
 * Tổng quan trang Sao lưu; đang có bản chạy thì tự tải lại tới khi xong.
 * @returns  kết quả useQuery; data = { targets, schedules, nextScheduledAt, lastSuccessAt, running… }
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

/** Tài khoản Google Drive vừa kết nối: gửi driveGrantId kèm nơi lưu khi bấm Lưu. */
export interface DriveConnection {
  driveGrantId: string;
  email: string;
}

/** Popup đã đóng thì còn chờ tin muộn bao lâu (trang callback gửi tin rồi mới tự đóng), mili giây. */
const POPUP_CLOSED_GRACE_MS = 1000;

/**
 * Chờ cửa sổ popup sang Google báo kết quả (bản thật): trang callback gửi DriveConnectMessage (postMessage cho cửa sổ này
 * và BroadcastChannel) rồi tự đóng.
 * @param url  đường dẫn sang Google
 * @returns    tài khoản đã kết nối
 * @throws     trình duyệt chặn popup, bấm Hủy ở Google, kết nối lỗi, hoặc đóng popup trước khi xong
 */
function connectInPopup(url: string): Promise<DriveConnection> {
  return new Promise((resolve, reject) => {
    const popup = window.open(url, 'ulaw-google-drive', 'width=520,height=680');
    if (!popup) {
      reject(new Error('Trình duyệt đã chặn cửa sổ đăng nhập Google. Cho phép cửa sổ bật lên rồi bấm Kết nối lại.'));
      return;
    }
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(DRIVE_CONNECT_CHANNEL);
    let closedTimer: ReturnType<typeof setInterval> | undefined;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    // Dọn dẹp khi đã có kết quả
    const finish = () => {
      window.removeEventListener('message', onWindowMessage);
      channel?.close();
      clearInterval(closedTimer);
      clearTimeout(graceTimer);
    };

    // Nhận tin (chỉ tin đúng dạng); lỗi thì báo câu theo loại lỗi
    const receive = (received: unknown) => {
      const parsed = DriveConnectMessageSchema.safeParse(received);
      if (!parsed.success) return;
      finish();
      if (parsed.data.ok) resolve({ driveGrantId: parsed.data.driveGrantId, email: parsed.data.email });
      else reject(new Error(BACKUP_MESSAGES.driveError[parsed.data.error]));
    };
    const onWindowMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) receive(event.data);
    };
    window.addEventListener('message', onWindowMessage);
    if (channel) channel.onmessage = (event: MessageEvent) => receive(event.data);

    // Popup đóng mà chưa có tin (chờ thêm một chút cho tin muộn) thì coi như bỏ
    closedTimer = setInterval(() => {
      if (!popup.closed) return;
      clearInterval(closedTimer);
      graceTimer = setTimeout(() => {
        finish();
        reject(new Error('Chưa kết nối: cửa sổ Google đã đóng.'));
      }, POPUP_CLOSED_GRACE_MS);
    }, 500);
  });
}

/**
 * Kết nối một tài khoản Google Drive (từ hộp thêm / sửa nơi lưu, trước khi Lưu).
 * Bản giả của máy chủ trả ngay tài khoản; bản thật trả đường dẫn sang Google, mở trong popup rồi chờ báo về.
 * @returns  kết quả useMutation; gọi mutateAsync({ email? }) → { driveGrantId, email }
 */
export function useConnectGoogleDrive() {
  return useMutation({
    mutationFn: async (connectRequest: ConnectGoogleDriveRequest): Promise<DriveConnection> => {
      const response = await apiFetch<ConnectGoogleDriveResponse>(ENDPOINTS.backups.driveConnect, { method: 'POST', body: JSON.stringify(connectRequest) });
      return response.kind === 'connected' ? { driveGrantId: response.driveGrantId, email: response.email } : connectInPopup(response.url);
    },
  });
}

/**
 * Xin máy chủ quyền mở Google Picker chọn thư mục Drive (tài khoản vừa kết nối hoặc của nơi lưu đang sửa).
 * @returns  kết quả useMutation; gọi mutateAsync({ driveGrantId } | { targetId }) → 'picker' kèm token, hoặc 'demo' (tài khoản kết nối bằng bản giả)
 */
export function useDrivePicker() {
  return useMutation({
    mutationFn: (pickerRequest: DrivePickerRequest) =>
      apiFetch<DrivePickerResponse>(ENDPOINTS.backups.drivePicker, { method: 'POST', body: JSON.stringify(pickerRequest) }),
  });
}

/**
 * Thêm, sửa hoặc bỏ một lịch định kì. Xong thì thay tổng quan bằng bản máy chủ trả về.
 * @returns  kết quả useMutation; gọi mutateAsync({ schedule, scheduleId? }) để thêm / sửa, mutateAsync({ scheduleId, remove: true }) để bỏ
 */
export function useSaveBackupSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: { schedule: BackupSchedule; scheduleId?: string } | { scheduleId: string; remove: true }) => {
      if ('remove' in change) return apiFetch<BackupsResponse>(backupSchedulePath(change.scheduleId), { method: 'DELETE' });
      return apiFetch<BackupsResponse>(change.scheduleId ? backupSchedulePath(change.scheduleId) : ENDPOINTS.backups.schedules, {
        method: change.scheduleId ? 'PUT' : 'POST',
        body: JSON.stringify(change.schedule),
      });
    },
    onSuccess: (response) => queryClient.setQueryData(BACKUPS_KEY, response),
  });
}

/**
 * Sao lưu ngay vào các nơi đã chọn (chạy nền; tổng quan tự tải lại tới khi xong).
 * @returns  kết quả useMutation; gọi mutateAsync(targetIds) → các lần sao lưu vừa bắt đầu, mỗi nơi một dòng
 */
export function useRunBackup() {
  return useBackupMutation((targetIds: string[]) =>
    apiFetch<BackupRun[]>(ENDPOINTS.backups.run, { method: 'POST', body: JSON.stringify({ targetIds }) }),
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
