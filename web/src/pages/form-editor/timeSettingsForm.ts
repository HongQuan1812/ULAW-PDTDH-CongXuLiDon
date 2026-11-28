/* Bản đang soạn của khung Cấu hình thời gian (nút đồng hồ ở trình soạn) và các phép trên đó. Mọi hàm đều thuần.
   Cấu hình thuộc loại đơn (mọi phiên bản), như mẫu xuất file: sửa chỉ ghi nhận ở đây, bấm Lưu ở trình soạn mới gửi lên máy chủ.
   Ô ngày, ô giờ tách riêng nên lúc gõ có thể mới có một trong hai: khi đó báo lỗi, không gửi lên. */
import {
  FORM_TYPE_TIME_ISSUE_TARGET,
  FORM_TYPE_TIME_MESSAGES,
  isVietnamMinute,
  validateFormTypeTimeSettings,
  type FormTypeIssue,
  type FormTypeTimeSettings,
  type SaveFormTypeTimeSettingsRequest,
} from '@ulaw/shared';

/** Một giờ hẹn đang soạn: ngày, giờ gõ riêng; cả hai trống = không hẹn. */
export interface ScheduleInput {
  /** Ngày 'YYYY-MM-DD', chữ đang gõ dở, hoặc '' */
  date: string;
  /** Giờ 'HH:mm' hoặc '' */
  time: string;
}

/** Các ô của khung Cấu hình thời gian. */
export interface TimeSettingsForm {
  /** Thời gian xử lí tối đa như đang gõ; '' = không có hạn */
  maxProcessingDays: string;
  autoOpen: ScheduleInput;
  /** Phiên bản sẽ tự mở */
  autoOpenVersion: number;
  autoClose: ScheduleInput;
}

/** Không hẹn giờ. */
export const NO_SCHEDULE: ScheduleInput = { date: '', time: '' };

/**
 * Ô của khung theo cấu hình đã lưu.
 * @param settings       cấu hình đã lưu
 * @param latestVersion  phiên bản mới nhất: phiên bản tự mở mặc định khi chưa hẹn giờ mở
 * @returns              các ô
 */
export function formOfTimeSettings(settings: FormTypeTimeSettings, latestVersion: number): TimeSettingsForm {
  return {
    maxProcessingDays: settings.maxProcessingDays === null ? '' : String(settings.maxProcessingDays),
    autoOpen: settings.autoOpen ? scheduleInputOf(settings.autoOpen.at) : NO_SCHEDULE,
    autoOpenVersion: settings.autoOpen?.version ?? latestVersion,
    autoClose: settings.autoClose ? scheduleInputOf(settings.autoClose.at) : NO_SCHEDULE,
  };
}

/**
 * Tách giờ hẹn thành ô ngày, ô giờ.
 * @param at  giờ Việt Nam 'YYYY-MM-DDTHH:mm'
 * @returns   ngày, giờ
 */
function scheduleInputOf(at: string): ScheduleInput {
  return { date: at.slice(0, 10), time: at.slice(11, 16) };
}

/**
 * Giờ hẹn gửi lên từ ô ngày, ô giờ.
 * @param input  ô ngày, ô giờ
 * @returns      null nếu trống cả hai; còn lại 'ngàyTgiờ' (có thể chưa hợp lệ, xem timeSettingsIssues)
 */
function scheduleAtOf(input: ScheduleInput): string | null {
  if (!input.date && !input.time) return null;
  return `${input.date}T${input.time}`;
}

/**
 * Dữ liệu gửi lên máy chủ khi bấm Lưu.
 * @param form  các ô của khung
 * @returns     body của lệnh lưu cấu hình thời gian
 */
export function toSaveTimeSettingsRequest(form: TimeSettingsForm): SaveFormTypeTimeSettingsRequest {
  const openAt = scheduleAtOf(form.autoOpen);
  const closeAt = scheduleAtOf(form.autoClose);
  return {
    maxProcessingDays: form.maxProcessingDays.trim() === '' ? null : Number(form.maxProcessingDays),
    autoOpen: openAt === null ? null : { at: openAt, version: form.autoOpenVersion },
    autoClose: closeAt === null ? null : { at: closeAt },
  };
}

/**
 * Hai bản soạn có cùng nội dung không: cùng dữ liệu gửi lên và cùng phiên bản tự mở
 * (ô phiên bản đứng trên ô giờ, chọn phiên bản trước rồi mới nhập giờ thì vẫn giữ lựa chọn).
 * @param firstForm   bản thứ nhất
 * @param secondForm  bản thứ hai
 * @returns           true nếu giống hệt nhau
 */
export function sameTimeSettings(firstForm: TimeSettingsForm, secondForm: TimeSettingsForm): boolean {
  return (
    firstForm.autoOpenVersion === secondForm.autoOpenVersion &&
    JSON.stringify(toSaveTimeSettingsRequest(firstForm)) === JSON.stringify(toSaveTimeSettingsRequest(secondForm))
  );
}

/**
 * Lỗi của khung trước khi lưu: giờ hẹn gõ chưa đủ ngày, giờ, rồi các luật chung (validateFormTypeTimeSettings) cho phần đã đủ.
 * @param form      các ô của khung
 * @param versions  số các phiên bản đã lưu của loại đơn
 * @param saved     cấu hình đang lưu, để biết giờ nào vừa sửa
 * @param now       lúc kiểm, giờ Việt Nam 'YYYY-MM-DDTHH:mm'
 * @returns         các lỗi theo thứ tự trong khung (thời gian xử lí, giờ mở, phiên bản, giờ đóng); hợp lệ thì []
 */
export function timeSettingsIssues(form: TimeSettingsForm, versions: readonly number[], saved: FormTypeTimeSettings, now: string): FormTypeIssue[] {
  const request = toSaveTimeSettingsRequest(form);
  const isOpenBroken = request.autoOpen !== null && !isVietnamMinute(request.autoOpen.at);
  const isCloseBroken = request.autoClose !== null && !isVietnamMinute(request.autoClose.at);

  // Giờ gõ chưa đủ: báo riêng, bỏ khỏi phần kiểm tra chung
  const formatIssues: FormTypeIssue[] = [
    ...(isOpenBroken ? [{ target: FORM_TYPE_TIME_ISSUE_TARGET.autoOpenAt, message: FORM_TYPE_TIME_MESSAGES.invalidTime }] : []),
    ...(isCloseBroken ? [{ target: FORM_TYPE_TIME_ISSUE_TARGET.autoCloseAt, message: FORM_TYPE_TIME_MESSAGES.invalidTime }] : []),
  ];
  const completeRequest = { ...request, autoOpen: isOpenBroken ? null : request.autoOpen, autoClose: isCloseBroken ? null : request.autoClose };
  const ruleIssues = validateFormTypeTimeSettings(completeRequest, versions, saved, now);

  // Xếp theo thứ tự các ô trong khung
  const targetOrder: string[] = Object.values(FORM_TYPE_TIME_ISSUE_TARGET);
  return [...formatIssues, ...ruleIssues].sort((first, second) => targetOrder.indexOf(first.target ?? '') - targetOrder.indexOf(second.target ?? ''));
}
