/* Hook gọi API Cấu hình email (chỉ vai trò có quyền manageEmail). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ENDPOINTS,
  type EmailSettings,
  type EmailSettingsResponse,
  type SendTestEmailRequest,
  type SendTestEmailResponse,
} from '@ulaw/shared';
import { apiFetch } from './client';

/** Khóa lưu tạm cấu hình email trong TanStack Query. */
export const EMAIL_SETTINGS_KEY = ['emailSettings'] as const;

/**
 * Cấu hình email đang dùng.
 * @returns  kết quả useQuery; data = { settings, mailServerConnected }
 */
export function useEmailSettings() {
  return useQuery({
    queryKey: EMAIL_SETTINGS_KEY,
    queryFn: () => apiFetch<EmailSettingsResponse>(ENDPOINTS.email.settings),
  });
}

/**
 * Lưu cả cấu hình email. Lưu xong thì thay dữ liệu đã tải bằng cấu hình máy chủ trả về.
 * @returns  kết quả useMutation; gọi mutateAsync(settings) → { settings, mailServerConnected }
 */
export function useSaveEmailSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: EmailSettings) =>
      apiFetch<EmailSettingsResponse>(ENDPOINTS.email.settings, { method: 'PUT', body: JSON.stringify(settings) }),
    onSuccess: (response) => queryClient.setQueryData(EMAIL_SETTINGS_KEY, response),
  });
}

/**
 * Gửi một thư thử theo bản đang soạn.
 * @returns  kết quả useMutation; gọi mutateAsync({ to, sender, subject, body }) → { message }
 */
export function useSendTestEmail() {
  return useMutation({
    mutationFn: (testEmail: SendTestEmailRequest) =>
      apiFetch<SendTestEmailResponse>(ENDPOINTS.email.test, { method: 'POST', body: JSON.stringify(testEmail) }),
  });
}
