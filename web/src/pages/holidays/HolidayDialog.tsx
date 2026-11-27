/* Hộp thoại "Thêm ngày nghỉ" / "Sửa ngày nghỉ": tên, từ ngày, đến ngày (nghỉ một ngày thì hai ô trùng nhau).
   Chọn Từ ngày mà Đến ngày còn trống hoặc đứng trước thì Đến ngày tự lấy theo Từ ngày.
   Dưới hai ô ngày: nghỉ bao nhiêu ngày, mấy ngày trong đó là Thứ Hai đến Thứ Sáu (hạn xử lí đơn chỉ lùi theo những ngày này).
   Trùng ngày với ngày nghỉ khác (409) thì báo dưới ô Đến ngày. Đang sửa thì có nút "Xóa ngày nghỉ" (hỏi lại ở hộp khác). */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  HOLIDAY_MESSAGES,
  HolidayInputSchema,
  holidayDatesOf,
  holidayDayCount,
  isCalendarDate,
  isWorkingDay,
  type Holiday,
  type HolidayInput,
} from '@ulaw/shared';
import { useSaveHoliday } from '../../api/holidays';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import styles from './HolidaysPage.module.css';

/** Không có ngày nghỉ nào: để đếm Thứ Hai đến Thứ Sáu trong khoảng đang nhập. */
const NO_HOLIDAYS = new Set<string>();

interface HolidayDialogProps {
  open: boolean;
  /** Ngày nghỉ cần sửa; null = thêm mới */
  holiday: Holiday | null;
  /** Thêm mới từ lịch (bấm một ô, hoặc giữ rồi kéo qua nhiều ô): điền sẵn Từ ngày, Đến ngày ('YYYY-MM-DD') */
  initialRange?: { startDate: string; endDate: string };
  onClose: () => void;
  /** Gọi sau khi lưu xong, kèm ngày nghỉ vừa lưu (để bảng hiện dòng đó) */
  onSaved: (holiday: Holiday) => void;
  /** Bấm "Xóa ngày nghỉ" (chỉ khi đang sửa): nơi gọi đóng hộp này rồi hỏi lại */
  onRemove: (holiday: Holiday) => void;
}

/**
 * Hộp thoại thêm / sửa ngày nghỉ.
 * @param props  xem HolidayDialogProps
 * @returns      hộp thoại
 */
export function HolidayDialog({ open, holiday, initialRange, onClose, onSaved, onRemove }: HolidayDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={holiday ? 'Sửa ngày nghỉ' : 'Thêm ngày nghỉ'}>
      {open && <HolidayForm key={holiday?.id ?? `new-${initialRange?.startDate ?? ''}-${initialRange?.endDate ?? ''}`} holiday={holiday} initialRange={initialRange} onClose={onClose} onSaved={onSaved} onRemove={onRemove} />}
    </Modal>
  );
}

/**
 * Câu nói ngày nghỉ đang nhập dài bao nhiêu.
 * @param startDate  từ ngày (có thể đang gõ dở)
 * @param endDate    đến ngày (có thể đang gõ dở)
 * @returns          vd 'Nghỉ 9 ngày, trong đó 5 ngày từ Thứ Hai đến Thứ Sáu.'; ngày chưa đủ, chưa đúng thì null
 */
function durationNote(startDate: string, endDate: string): string | null {
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate) || endDate < startDate) return null;
  const range = { startDate, endDate };
  const weekdayCount = [...holidayDatesOf([range])].filter((date) => isWorkingDay(date, NO_HOLIDAYS)).length;
  const dayCount = holidayDayCount(range);
  if (dayCount === 1) return weekdayCount === 1 ? 'Nghỉ 1 ngày.' : 'Nghỉ 1 ngày, rơi vào cuối tuần nên không làm hạn xử lí đơn lùi lại.';
  return `Nghỉ ${dayCount} ngày, trong đó ${weekdayCount} ngày từ Thứ Hai đến Thứ Sáu.`;
}

/**
 * Form ngày nghỉ.
 * @param holiday      ngày nghỉ cần sửa; null = thêm mới
 * @param initialRange thêm mới từ lịch: khoảng ngày điền sẵn
 * @param onClose   gọi khi bấm Hủy hoặc lưu xong
 * @param onSaved   gọi sau khi lưu xong
 * @param onRemove  gọi khi bấm Xóa ngày nghỉ
 * @returns         form
 */
function HolidayForm({ holiday, initialRange, onClose, onSaved, onRemove }: Omit<HolidayDialogProps, 'open'>) {
  const toast = useToast();
  const saveHoliday = useSaveHoliday();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<HolidayInput>({
    resolver: zodResolver(HolidayInputSchema),
    defaultValues: holiday
      ? { name: holiday.name, startDate: holiday.startDate, endDate: holiday.endDate }
      : { name: '', startDate: initialRange?.startDate ?? '', endDate: initialRange?.endDate ?? '' },
  });
  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const note = durationNote(startDate, endDate);

  // Hộp mở ra thì đưa con trỏ vào ô tên
  useEffect(() => setFocus('name'), [setFocus]);

  /**
   * Đổi Từ ngày: Đến ngày còn trống, chưa đúng hoặc đứng trước thì lấy theo Từ ngày.
   * @param nextStartDate  ngày vừa chọn / gõ
   * @param onChange       báo cho react-hook-form
   */
  const changeStartDate = (nextStartDate: string, onChange: (nextValue: string) => void) => {
    onChange(nextStartDate);
    if (isCalendarDate(nextStartDate) && (!isCalendarDate(endDate) || endDate < nextStartDate)) setValue('endDate', nextStartDate, { shouldValidate: !!errors.endDate });
  };

  // Lưu: trùng ngày nghỉ khác (409) thì báo dưới ô Đến ngày; lỗi khác hiện toast
  const onSubmit = handleSubmit(async (holidayInput) => {
    try {
      const saved = await saveHoliday.mutateAsync({ holidayId: holiday?.id ?? null, holidayInput });
      toast(holiday ? HOLIDAY_MESSAGES.saved(saved.name) : HOLIDAY_MESSAGES.created(saved.name), 'success');
      onSaved(saved);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : HOLIDAY_MESSAGES[422];
      if (error instanceof ApiError && error.status === 409) {
        setError('endDate', { message });
        return;
      }
      toast(message, 'error');
    }
  });

  return (
    <form className={styles.dialogBody} onSubmit={onSubmit} noValidate>
      <Field label="Tên ngày nghỉ" required error={errors.name?.message}>
        <input autoComplete="off" placeholder="VD: Tết Nguyên đán" aria-required="true" aria-invalid={!!errors.name} {...register('name')} />
      </Field>

      <div className={styles.dateGrid}>
        <Field label="Từ ngày" required error={errors.startDate?.message}>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DateInput
                value={field.value}
                onValueChange={(nextValue) => changeStartDate(nextValue, field.onChange)}
                onBlur={field.onBlur}
                placeholder="dd/mm/yyyy"
                aria-required="true"
                aria-invalid={!!errors.startDate}
              />
            )}
          />
        </Field>
        <Field label="Đến ngày" required hint="Nghỉ một ngày thì trùng Từ ngày" error={errors.endDate?.message}>
          <Controller
            control={control}
            name="endDate"
            render={({ field }) => (
              <DateInput
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="dd/mm/yyyy"
                aria-required="true"
                aria-invalid={!!errors.endDate}
              />
            )}
          />
        </Field>
      </div>
      {note && <p className={styles.dialogText}>{note}</p>}

      <div className={styles.dialogButtons}>
        {holiday && (
          <Button variant="danger" onClick={() => onRemove(holiday)}>
            Xóa ngày nghỉ
          </Button>
        )}
        <span className={styles.spacer} />
        <Button variant="ghost" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" disabled={saveHoliday.isPending}>
          {saveHoliday.isPending ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </div>
    </form>
  );
}
