/* Hook gọi API Ngày nghỉ (chỉ vai trò có quyền manageHolidays). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS, holidayPath, type Holiday, type HolidayInput, type HolidaysResponse } from '@ulaw/shared';
import { apiFetch } from './client';

/** Khóa lưu tạm danh sách ngày nghỉ trong TanStack Query. */
export const HOLIDAYS_KEY = ['holidays'] as const;

/**
 * Mọi ngày nghỉ (ít, tải hết một lượt).
 * @returns  kết quả useQuery; data = các ngày nghỉ, sớm trước muộn sau
 */
export function useHolidays() {
  return useQuery({
    queryKey: HOLIDAYS_KEY,
    queryFn: () => apiFetch<HolidaysResponse>(ENDPOINTS.holidays.list),
    select: (response) => response.holidays,
  });
}

/**
 * Lệnh đổi ngày nghỉ; xong thì tải lại danh sách ngày nghỉ và các đơn (hạn xử lí tính theo ngày nghỉ).
 * @param mutationFn  lệnh gọi API
 * @returns           kết quả useMutation
 */
function useHolidayMutation<Variables, Result>(mutationFn: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: HOLIDAYS_KEY }), queryClient.invalidateQueries({ queryKey: ['forms'] })]),
  });
}

/**
 * Thêm hoặc sửa một ngày nghỉ.
 * @returns  kết quả useMutation; gọi mutateAsync({ holidayId, holidayInput }) → ngày nghỉ sau khi lưu; holidayId null = thêm mới
 */
export function useSaveHoliday() {
  return useHolidayMutation(({ holidayId, holidayInput }: { holidayId: string | null; holidayInput: HolidayInput }) =>
    apiFetch<Holiday>(holidayId ? holidayPath(holidayId) : ENDPOINTS.holidays.list, {
      method: holidayId ? 'PUT' : 'POST',
      body: JSON.stringify(holidayInput),
    }),
  );
}

/**
 * Xóa một ngày nghỉ.
 * @returns  kết quả useMutation; gọi mutateAsync(holidayId)
 */
export function useRemoveHoliday() {
  return useHolidayMutation((holidayId: string) => apiFetch<void>(holidayPath(holidayId), { method: 'DELETE' }));
}
