import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { SESSION_KEY, handleUnauthorized } from './auth';
import { ApiError } from './client';

/**
 * Tạo nơi lưu tạm có sẵn phiên đăng nhập và dữ liệu một lá đơn.
 * @returns  QueryClient đã điền dữ liệu
 */
function signedInQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  queryClient.setQueryData(SESSION_KEY, { user: { id: 'sv-1' } });
  queryClient.setQueryData(['form', 'XMM-2026-001-01354'], { code: 'XMM-2026-001-01354' });
  return queryClient;
}

describe('handleUnauthorized', () => {
  it('lỗi 401: phiên thành null, bỏ dữ liệu của phiên cũ', () => {
    const queryClient = signedInQueryClient();
    handleUnauthorized(queryClient, new ApiError(401, 'Bạn chưa đăng nhập.'));
    expect(queryClient.getQueryData(SESSION_KEY)).toBeNull();
    expect(queryClient.getQueryData(['form', 'XMM-2026-001-01354'])).toBeUndefined();
  });

  it('lỗi khác (403, 404, lỗi mạng): giữ nguyên', () => {
    const queryClient = signedInQueryClient();
    handleUnauthorized(queryClient, new ApiError(403, 'Không có quyền.'));
    handleUnauthorized(queryClient, new ApiError(404, 'Không có đơn.'));
    handleUnauthorized(queryClient, new TypeError('Failed to fetch'));
    expect(queryClient.getQueryData(SESSION_KEY)).toEqual({ user: { id: 'sv-1' } });
    expect(queryClient.getQueryData(['form', 'XMM-2026-001-01354'])).toEqual({ code: 'XMM-2026-001-01354' });
  });
});
