/* Luật hẹn giờ mở / đóng loại đơn: tới giờ chưa, cần đổi trạng thái phiên bản nào, giữ hay bỏ dấu đã chạy.
   Giờ đều là giờ Việt Nam, dạng chữ 'YYYY-MM-DDTHH:mm…'. Máy chủ kiểm mỗi phút; API giả và backend cùng dùng. */
import type { FormTypeTimeSettings, SaveFormTypeTimeSettingsRequest } from '../api-contract/form-types';
import type { FormTypeStatus } from '../aux-schema/form-types--statuses';

/** Một việc hẹn giờ đã tới lúc chạy. */
export type ScheduleStep = { kind: 'open'; at: string; version: number } | { kind: 'close'; at: string };

/** Phiên bản và trạng thái hiện tại, đủ để biết cần đổi gì. */
export interface VersionStatusOf {
  version: number;
  status: FormTypeStatus;
}

/** Lệnh đổi trạng thái một phiên bản, như cán bộ bấm tay. */
export interface ScheduledStatusChange {
  version: number;
  status: 'open' | 'closed';
}

/**
 * Cấu hình thời gian sau khi lưu: giờ nào không đổi thì giữ dấu đã chạy, sửa giờ thì bỏ dấu (đổi phiên bản tự mở không ảnh hưởng dấu).
 * @param previous  cấu hình đang lưu
 * @param request   cấu hình gửi lên (đã kiểm tra)
 * @returns         cấu hình mới để lưu
 */
export function timeSettingsAfterSave(previous: FormTypeTimeSettings, request: SaveFormTypeTimeSettingsRequest): FormTypeTimeSettings {
  const { autoOpen, autoClose } = request;
  const isSameOpen = Boolean(autoOpen && previous.autoOpen && autoOpen.at === previous.autoOpen.at);
  const isSameClose = Boolean(autoClose && previous.autoClose && autoClose.at === previous.autoClose.at);
  return {
    maxProcessingDays: request.maxProcessingDays,
    autoOpen: autoOpen ? { ...autoOpen, done: isSameOpen && previous.autoOpen!.done } : null,
    autoClose: autoClose ? { ...autoClose, done: isSameClose && previous.autoClose!.done } : null,
  };
}

/**
 * Các việc hẹn giờ đã tới lúc mà chưa chạy, sớm trước (vd máy chủ tắt qua cả giờ mở lẫn giờ đóng thì mở rồi đóng).
 * @param settings  cấu hình thời gian của loại đơn
 * @param now       lúc kiểm, giờ Việt Nam 'YYYY-MM-DDTHH:mm' (phần giây trở đi bỏ qua)
 * @returns         các việc cần chạy; không có thì []
 */
export function dueScheduleSteps(settings: FormTypeTimeSettings, now: string): ScheduleStep[] {
  const minute = now.slice(0, 16);
  const steps: ScheduleStep[] = [];

  // Giờ tự mở, giờ tự đóng: tới giờ (tính cả đúng phút đó) và chưa đánh dấu đã chạy
  const { autoOpen, autoClose } = settings;
  if (autoOpen && !autoOpen.done && autoOpen.at <= minute) steps.push({ kind: 'open', at: autoOpen.at, version: autoOpen.version });
  if (autoClose && !autoClose.done && autoClose.at <= minute) steps.push({ kind: 'close', at: autoClose.at });

  return steps.sort((first, second) => first.at.localeCompare(second.at));
}

/**
 * Việc hẹn giờ cần đổi trạng thái phiên bản nào. Trạng thái đã đúng thì không đổi gì (vd cán bộ đã đóng tay trước giờ đóng).
 * @param step      việc tới giờ
 * @param versions  các phiên bản hiện có và trạng thái
 * @returns         lệnh đổi trạng thái; không cần đổi (hoặc phiên bản tự mở không còn) thì null
 */
export function scheduledStatusChangeOf(step: ScheduleStep, versions: readonly VersionStatusOf[]): ScheduledStatusChange | null {
  // Tự mở: mở đúng phiên bản đã chọn (kể cả bản Nháp); phiên bản đang mở khác tự đóng như khi bấm tay
  if (step.kind === 'open') {
    const target = versions.find((version) => version.version === step.version);
    return target && target.status !== 'open' ? { version: target.version, status: 'open' } : null;
  }

  // Tự đóng: đóng phiên bản đang mở
  const openVersion = versions.find((version) => version.status === 'open');
  return openVersion ? { version: openVersion.version, status: 'closed' } : null;
}

/**
 * Đánh dấu một việc hẹn giờ đã chạy; giờ vẫn giữ để hiện "✓ đã mở" / "✓ đã đóng".
 * @param settings  cấu hình thời gian
 * @param kind      việc vừa chạy
 * @returns         cấu hình mới (không sửa cấu hình cũ)
 */
export function markScheduleStepDone(settings: FormTypeTimeSettings, kind: ScheduleStep['kind']): FormTypeTimeSettings {
  if (kind === 'open') return settings.autoOpen ? { ...settings, autoOpen: { ...settings.autoOpen, done: true } } : settings;
  return settings.autoClose ? { ...settings, autoClose: { ...settings.autoClose, done: true } } : settings;
}

/**
 * Giờ loại đơn ngừng nhận đơn, để sinh viên thấy "Nhận đơn đến …".
 * @param settings  cấu hình thời gian
 * @returns         giờ tự đóng chưa chạy, 'YYYY-MM-DDTHH:mm'; không hẹn hoặc đã chạy thì null
 */
export function pendingCloseAt(settings: FormTypeTimeSettings): string | null {
  return settings.autoClose && !settings.autoClose.done ? settings.autoClose.at : null;
}
