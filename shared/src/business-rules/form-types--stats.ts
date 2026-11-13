/* Trạng thái của cả loại đơn khi thống kê (màu cột của biểu đồ "Theo loại đơn"). */
import type { FormTypeStatus } from '../aux-schema/form-types--statuses';

/**
 * Trạng thái của cả loại đơn: có bất kỳ phiên bản nào đang mở thì là Đang mở (còn nhận đơn);
 * không có thì lấy trạng thái của phiên bản mới nhất.
 * @param versionStatuses  trạng thái các phiên bản, từ cũ tới mới (phiên bản mới nhất ở cuối)
 * @returns                'open' nếu có phiên bản đang mở, ngược lại trạng thái phiên bản mới nhất
 */
export function formTypeStatusOf(versionStatuses: readonly FormTypeStatus[]): FormTypeStatus {
  if (versionStatuses.includes('open')) return 'open';
  return versionStatuses[versionStatuses.length - 1]!;
}
