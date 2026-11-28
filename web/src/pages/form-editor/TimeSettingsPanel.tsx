/* Khung nổi "Cấu hình thời gian" của trình soạn loại đơn, mở từ nút tròn đồng hồ ở góc phải dưới (EditorDock.tsx).
   Gồm hai mục: Thời gian xử lí (số ngày làm việc tối đa) và Thời gian đóng mở (một giờ tự mở kèm phiên bản sẽ mở, một giờ tự đóng).
   Cấu hình thuộc loại đơn (mọi phiên bản), không tạo phiên bản mới: sửa chỉ ghi nhận, bấm Lưu ở hàng nút cuối mới gửi lên (timeSettingsForm.ts).
   Giờ đã chạy hiện kèm "✓ đã mở" / "✓ đã đóng"; sửa sang giờ khác thì dấu mất, tới giờ mới lại chạy. Bấm Esc thì đóng khung. */
import type { UseQueryResult } from '@tanstack/react-query';
import {
  FORM_TYPE_STATUS_LABEL,
  FORM_TYPE_TIME_ISSUE_TARGET,
  MAX_PROCESSING_DAYS_LIMIT,
  type FormTypeIssue,
  type FormTypeStatus,
  type FormTypeTimeSettings,
} from '@ulaw/shared';
import { DateInput } from '../../components/DateInput';
import { Field } from '../../components/Field';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { EditorIconButton } from './EditorIconButton';
import { EditorPopup } from './EditorPopup';
import { NO_SCHEDULE, toSaveTimeSettingsRequest, type ScheduleInput, type TimeSettingsForm } from './timeSettingsForm';
import styles from './TimeSettingsPanel.module.css';

/** Tên khung, dùng cho nút tròn và tiêu đề. */
export const TIME_SETTINGS_TITLE = 'Cấu hình thời gian';

/** Một phiên bản chọn được làm phiên bản tự mở. */
export interface AutoOpenVersionChoice {
  version: number;
  status: FormTypeStatus;
}

export interface TimeSettingsPanelProps {
  /** Các ô đang hiện (thay đổi chưa lưu, hoặc theo cấu hình đã lưu) */
  form: TimeSettingsForm;
  /** Cấu hình đã lưu ở máy chủ; loại đơn mới chưa lưu thì null (chưa có gì) */
  settingsQuery: UseQueryResult<FormTypeTimeSettings> | null;
  /** Các phiên bản đã lưu, mới nhất trước; loại đơn mới thì phiên bản 1 sắp tạo */
  versionChoices: readonly AutoOpenVersionChoice[];
  /** Lỗi cần hiện (chỉ sau khi đã bấm Lưu mà còn lỗi) */
  issues: readonly FormTypeIssue[];
  /** Gọi với các ô mới */
  onFormChange: (nextForm: TimeSettingsForm) => void;
  /** Đang lưu: không cho sửa */
  saving: boolean;
}

/**
 * Câu báo lỗi của các ô (các câu nối lại).
 * @param issues   các lỗi
 * @param targets  các ô cần lấy
 * @returns        câu báo, hoặc undefined nếu các ô đều không lỗi
 */
function errorOf(issues: readonly FormTypeIssue[], ...targets: string[]): string | undefined {
  const messages = issues.filter((issue) => issue.target !== null && targets.includes(issue.target)).map((issue) => issue.message);
  return messages.length ? messages.join(' ') : undefined;
}

/**
 * Khung nổi Cấu hình thời gian.
 * @param props  xem TimeSettingsPanelProps; onClose: bấm nút đóng hoặc Esc
 * @returns      khung nổi: đầu khung (tên, lời giới thiệu, nút đóng) và hai mục
 */
export function TimeSettingsPanel({ form, settingsQuery, versionChoices, issues, onFormChange, saving, onClose }: TimeSettingsPanelProps & { onClose: () => void }) {
  // Cấu hình đã lưu: loại đơn mới thì chưa có gì; đang tải hoặc lỗi thì chưa cho sửa
  const saved = settingsQuery?.data ?? null;
  const isLoading = settingsQuery !== null && settingsQuery.isPending;
  const loadFailed = settingsQuery !== null && !settingsQuery.isPending && !settingsQuery.data;
  const locked = saving || isLoading || loadFailed;

  // Giờ đã chạy và chưa sửa thì hiện dấu ✓
  const request = toSaveTimeSettingsRequest(form);
  const isOpenDone = Boolean(saved?.autoOpen?.done && request.autoOpen?.at === saved.autoOpen.at);
  const isCloseDone = Boolean(saved?.autoClose?.done && request.autoClose?.at === saved.autoClose.at);
  const maxDaysError = errorOf(issues, FORM_TYPE_TIME_ISSUE_TARGET.maxProcessingDays);
  const versionError = errorOf(issues, FORM_TYPE_TIME_ISSUE_TARGET.autoOpenVersion);

  return (
    <EditorPopup
      title={TIME_SETTINGS_TITLE}
      intro="Áp dụng cho mọi phiên bản của loại đơn, không tạo phiên bản mới. Bấm Lưu ở cuối trang để lưu."
      className={styles.popup}
      onClose={onClose}
    >
        {isLoading && <p className={styles.hint}>Đang tải cấu hình thời gian…</p>}
        {loadFailed && settingsQuery && (
          <div className={styles.loadError}>
            <LoadError message={loadErrorMessage(settingsQuery) ?? 'Không tải được cấu hình thời gian.'} />
            <RefreshButton query={settingsQuery} label="cấu hình thời gian" />
          </div>
        )}

        <fieldset className={styles.blocks} disabled={locked}>
          {/* Thời gian xử lí */}
          <section className={styles.block}>
            <h3 className={styles.blockTitle}>Thời gian xử lí</h3>
            <Field
              label="Thời gian xử lí tối đa (ngày làm việc)"
              hint="Tính từ lúc nộp, chỉ đếm Thứ Hai đến Thứ Sáu, trừ ngày nghỉ; dừng khi chờ bổ sung. Để trống nếu không có hạn. Sửa chỉ áp dụng cho đơn nộp sau đó"
              error={maxDaysError}
            >
              <input
                type="number"
                inputMode="numeric"
                className={styles.daysInput}
                min={1}
                max={MAX_PROCESSING_DAYS_LIMIT}
                step={1}
                value={form.maxProcessingDays}
                placeholder="Không có hạn"
                aria-invalid={Boolean(maxDaysError) || undefined}
                onChange={(event) => onFormChange({ ...form, maxProcessingDays: event.target.value })}
              />
            </Field>
          </section>

          {/* Thời gian đóng mở */}
          <section className={styles.block}>
            <h3 className={styles.blockTitle}>Thời gian đóng mở</h3>
            <p className={styles.hint}>
              Giờ Việt Nam. Xóa trống là bỏ hẹn; hẹn đợt mới thì sửa giờ cũ. Vẫn mở / đóng tay được ở thẻ Thông tin loại đơn: tới giờ hẹn mà trạng thái đã đúng thì
              không đổi gì.
            </p>

            <Field
              label="Phiên bản tự mở"
              hint="Mặc định phiên bản mới nhất; chọn được cả bản Nháp (tới giờ nội dung khóa lại như bấm Đang mở)"
              error={versionError}
            >
              <select
                className={styles.versionSelect}
                value={form.autoOpenVersion}
                aria-invalid={Boolean(versionError) || undefined}
                onChange={(event) => onFormChange({ ...form, autoOpenVersion: Number(event.target.value) })}
              >
                {/* Phiên bản đang chọn mà không còn (vd vừa xóa bản Nháp) vẫn hiện để thấy lỗi */}
                {!versionChoices.some((choice) => choice.version === form.autoOpenVersion) && (
                  <option value={form.autoOpenVersion}>Phiên bản {form.autoOpenVersion} (không còn)</option>
                )}
                {versionChoices.map((choice, index) => (
                  <option key={choice.version} value={choice.version}>
                    Phiên bản {choice.version} · {FORM_TYPE_STATUS_LABEL[choice.status]}
                    {index === 0 ? ' (mới nhất)' : ''}
                  </option>
                ))}
              </select>
            </Field>

            <ScheduleField
              label="Tự mở lúc"
              hint="Tới giờ thì phiên bản chọn ở trên tự mở; phiên bản đang mở khác tự đóng"
              action="mở"
              input={form.autoOpen}
              isDone={isOpenDone}
              error={errorOf(issues, FORM_TYPE_TIME_ISSUE_TARGET.autoOpenAt)}
              onInputChange={(autoOpen) => onFormChange({ ...form, autoOpen })}
            />

            <ScheduleField
              label="Tự đóng lúc"
              hint="Tới giờ thì phiên bản đang mở tự đóng; đơn đã nộp vẫn xử lí bình thường"
              action="đóng"
              input={form.autoClose}
              isDone={isCloseDone}
              error={errorOf(issues, FORM_TYPE_TIME_ISSUE_TARGET.autoCloseAt)}
              onInputChange={(autoClose) => onFormChange({ ...form, autoClose })}
            />
          </section>
        </fieldset>
    </EditorPopup>
  );
}

interface ScheduleFieldProps {
  label: string;
  hint: string;
  /** "mở" hoặc "đóng": ghi trên dấu đã chạy, tên ô và nút bỏ hẹn */
  action: 'mở' | 'đóng';
  input: ScheduleInput;
  /** Giờ này đã chạy và chưa sửa: hiện "✓ đã mở" / "✓ đã đóng" */
  isDone: boolean;
  /** Câu báo lỗi dưới ô; có thì ô ngày, ô giờ tô đỏ */
  error: string | undefined;
  onInputChange: (nextInput: ScheduleInput) => void;
}

/**
 * Một giờ hẹn: ô ngày, ô giờ, nút bỏ hẹn, dấu đã chạy.
 * @param props  xem ScheduleFieldProps
 * @returns      ô có nhãn, ghi chú, câu báo lỗi
 */
function ScheduleField({ label, hint, action, input, isDone, error, onInputChange }: ScheduleFieldProps) {
  const hasSchedule = Boolean(input.date || input.time);
  const timeInvalid = Boolean(error);
  return (
    <Field label={label} hint={hint} error={error}>
      <span className={styles.scheduleRow}>
        <DateInput
          className={styles.dateInput}
          value={input.date}
          aria-label={`Ngày tự ${action}`}
          aria-invalid={timeInvalid || undefined}
          onValueChange={(date) => onInputChange({ ...input, date })}
        />
        <input
          type="time"
          className={styles.timeInput}
          value={input.time}
          aria-label={`Giờ tự ${action}`}
          aria-invalid={timeInvalid || undefined}
          onChange={(event) => onInputChange({ ...input, time: event.target.value })}
        />
        {hasSchedule && <EditorIconButton icon="remove" label={`Bỏ hẹn giờ ${action}`} onClick={() => onInputChange(NO_SCHEDULE)} />}
        {isDone && <span className={styles.done}>✓ đã {action}</span>}
      </span>
    </Field>
  );
}
