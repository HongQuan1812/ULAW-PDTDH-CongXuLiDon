/* Trang Ngày nghỉ (#/cau-hinh/ngay-nghi, vai trò có quyền manageHolidays: Admin).
   Lịch cả năm, 12 tháng: ngày nghỉ (lễ, Tết, nghỉ bù do Admin nhập) tô màu xanh, Thứ Bảy, Chủ nhật tô xám (luôn nghỉ, không nhập),
   hôm nay có viền. Hạn xử lí đơn không tính cả hai loại ngày này. Không có ngày làm bù.
   Đầu thẻ: ‹ năm › để đổi năm, chú thích màu. Bấm một ngày nghỉ để sửa (Xóa nằm trong hộp sửa, hỏi lại trước khi xóa);
   bấm một ngày khác để thêm ngày nghỉ một ngày. Nhấn giữ một ngày rồi kéo (chuột: nhấn rồi kéo; màn hình cảm ứng: giữ một lúc rồi kéo)
   để chọn nhiều ngày, qua được nhiều tháng; thả ra thì mở hộp thêm, điền sẵn từ ngày nào đến ngày nào.
   Dưới lịch: các ngày nghỉ trong năm, kèm tên (lịch chỉ có màu). */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { HOLIDAY_MESSAGES, WEEKDAY_LABEL, holidayDatesOf, holidayDayCount, isWorkingDay, vietnamTimeOf, type Holiday } from '@ulaw/shared';
import { useHolidays, useRemoveHoliday } from '../../api/holidays';
import { Button } from '../../components/Button';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { Modal } from '../../components/Modal';
import { RefreshButton } from '../../components/RefreshButton';
import { useToast } from '../../components/Toast';
import { formatDate } from '../../lib/format';
import { BackToSettings } from '../settings/BackToSettings';
import settingsStyles from '../settings/SettingsPage.module.css';
import profileStyles from '../profile/ProfilePage.module.css';
import { HolidayDialog } from './HolidayDialog';
import styles from './HolidaysPage.module.css';

/** Tên cột thứ trên lịch, Thứ Hai trước. */
const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Không có ngày nghỉ nào: để biết một ngày có phải Thứ Bảy, Chủ nhật không. */
const NO_HOLIDAYS = new Set<string>();

/** Màn hình cảm ứng: giữ bao lâu thì bắt đầu chọn nhiều ngày (mili giây); kéo sớm hơn là cuộn trang. */
const TOUCH_HOLD_MS = 350;

/** Màn hình cảm ứng: ngón tay lệch quá từng này (px) trước khi đủ thời gian giữ thì coi là cuộn trang. */
const TOUCH_SLOP_PX = 8;

/** Một khoảng ngày 'YYYY-MM-DD', tính cả hai đầu. */
interface DateRange {
  startDate: string;
  endDate: string;
}

/** Hộp thêm / sửa đang mở: sửa một ngày nghỉ, hoặc thêm mới (từ nút, hoặc từ lịch: một ô hay một khoảng kéo chọn). */
type Editing = { holiday: Holiday } | { holiday: null; range?: DateRange };

/**
 * Ngày 'YYYY-MM-DD' từ năm, tháng, ngày.
 * @param year   vd 2026
 * @param month  1–12
 * @param day    1–31
 * @returns      vd '2026-02-14'
 */
function dateOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Thứ của một ngày, Thứ Hai = 0 … Chủ nhật = 6 (thứ tự cột trên lịch).
 * @param date  'YYYY-MM-DD'
 * @returns     0–6
 */
function mondayFirstWeekday(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Khoảng ngày từ hai đầu, đầu nào trước cũng được.
 * @param firstDate   một đầu
 * @param secondDate  đầu kia
 * @returns           ngày đầu không sau ngày cuối
 */
function rangeOf(firstDate: string, secondDate: string): DateRange {
  return firstDate <= secondDate ? { startDate: firstDate, endDate: secondDate } : { startDate: secondDate, endDate: firstDate };
}

/**
 * Hai dòng mô tả một ngày nghỉ: ngày, và dài bao lâu. Mục nào cũng đủ hai dòng để các mục thẳng hàng.
 * @param holiday  ngày nghỉ
 * @returns        vd ['14/02/2026 – 22/02/2026', '9 ngày · 5 ngày làm việc'], một ngày: ['Thứ Năm 01/01/2026', '1 ngày làm việc']
 */
function holidaySpanLines(holiday: Holiday): [string, string] {
  const dayCount = holidayDayCount(holiday);
  const workingDayCount = [...holidayDatesOf([holiday])].filter((date) => isWorkingDay(date, NO_HOLIDAYS)).length;
  const workingText = workingDayCount === 0 ? 'rơi vào cuối tuần' : `${workingDayCount} ngày làm việc`;
  if (dayCount === 1) return [`${WEEKDAY_LABEL[mondayFirstWeekday(holiday.startDate) + 1]} ${formatDate(holiday.startDate)}`, `1 ngày · ${workingText}`];
  return [`${formatDate(holiday.startDate)} – ${formatDate(holiday.endDate)}`, `${dayCount} ngày · ${workingText}`];
}

/**
 * Trang Ngày nghỉ.
 * @returns  đầu trang, thẻ lịch năm, các ngày nghỉ trong năm, hộp thêm / sửa, hộp hỏi lại khi xóa
 */
export function HolidaysPage() {
  const toast = useToast();
  const holidaysQuery = useHolidays();
  const removeHoliday = useRemoveHoliday();
  const errorMessage = loadErrorMessage(holidaysQuery);
  const today = vietnamTimeOf(new Date()).slice(0, 10);
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<Holiday | null>(null);

  // Ngày nghỉ của từng ngày, và các ngày nghỉ chạm vào năm đang xem (sớm trước)
  const holidays = holidaysQuery.data;
  const holidayByDate = useMemo(() => {
    const byDate = new Map<string, Holiday>();
    for (const holiday of holidays ?? []) for (const date of holidayDatesOf([holiday])) byDate.set(date, holiday);
    return byDate;
  }, [holidays]);
  const yearHolidays = (holidays ?? []).filter((holiday) => holiday.startDate <= `${year}-12-31` && holiday.endDate >= `${year}-01-01`);

  /**
   * Bấm một ô trên lịch: ngày nghỉ thì sửa, ngày khác thì thêm ngày nghỉ một ngày.
   * @param date  'YYYY-MM-DD'
   */
  const openDate = (date: string) => {
    const holiday = holidayByDate.get(date);
    setEditing(holiday ? { holiday } : { holiday: null, range: { startDate: date, endDate: date } });
  };

  // Giữ rồi kéo: thả ra trên cùng một ô thì như bấm ô đó, kéo qua nhiều ô thì thêm ngày nghỉ cho cả khoảng
  const rangeDrag = useDateRangeDrag((range) => (range.startDate === range.endDate ? openDate(range.startDate) : setEditing({ holiday: null, range })));

  /** Xóa ngày nghỉ đang hỏi. */
  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await removeHoliday.mutateAsync(removing.id);
      toast(HOLIDAY_MESSAGES.removed(removing.name), 'success');
      setRemoving(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : HOLIDAY_MESSAGES[422], 'error');
    }
  };

  return (
    <div className={profileStyles.page}>
      <BackToSettings />
      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Ngày nghỉ</h1>
          <p className={styles.subtitle}>
            Hạn xử lí đơn không tính ngày nghỉ và Thứ Bảy, Chủ nhật. Bấm một ngày để thêm hoặc sửa; nhấn giữ rồi kéo để chọn nhiều ngày.
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({ holiday: null })}>
          + Thêm ngày nghỉ
        </Button>
      </div>

      <section className={`${profileStyles.card} ${styles.calendarCard}`} aria-labelledby="holidays-year">
        {/* Đầu thẻ: đổi năm, nút ↻, chú thích màu */}
        <div className={styles.calendarHead}>
          <div className={styles.yearNav}>
            <button type="button" className={styles.yearButton} onClick={() => setYear(year - 1)} aria-label={`Năm ${year - 1}`}>
              ‹
            </button>
            <h2 id="holidays-year" className={styles.year}>
              Năm {year}
            </h2>
            <button type="button" className={styles.yearButton} onClick={() => setYear(year + 1)} aria-label={`Năm ${year + 1}`}>
              ›
            </button>
            {year !== Number(today.slice(0, 4)) && (
              <button type="button" className={styles.linkButton} onClick={() => setYear(Number(today.slice(0, 4)))}>
                Năm nay
              </button>
            )}
            <RefreshButton query={holidaysQuery} label="Ngày nghỉ" size="small" />
          </div>
          <ul className={styles.legend} aria-label="Chú thích">
            <li>
              <i className={styles.legendHoliday} aria-hidden="true" />
              Ngày nghỉ
            </li>
            <li>
              <i className={styles.legendWeekend} aria-hidden="true" />
              Thứ Bảy, Chủ nhật
            </li>
            <li>
              <i className={styles.legendToday} aria-hidden="true" />
              Hôm nay
            </li>
          </ul>
        </div>

        {holidaysQuery.isPending ? (
          <p className={profileStyles.muted}>Đang tải ngày nghỉ…</p>
        ) : errorMessage ? (
          <LoadError message={errorMessage} />
        ) : (
          <>
            <div className={styles.months}>
              {Array.from({ length: 12 }, (_, monthIndex) => (
                <MonthCalendar
                  key={monthIndex}
                  year={year}
                  month={monthIndex + 1}
                  today={today}
                  holidayByDate={holidayByDate}
                  selecting={rangeDrag.selecting}
                  onPressDate={rangeDrag.press}
                  onOpenDate={openDate}
                />
              ))}
            </div>

            {/* Các ngày nghỉ trong năm: lịch chỉ có màu, đây là chỗ đọc tên */}
            <div className={styles.yearList}>
              <h3>
                Ngày nghỉ năm {year} <span className={styles.count}>{yearHolidays.length}</span>
              </h3>
              {yearHolidays.length === 0 ? (
                <p className={styles.emptyNote}>Chưa có ngày nghỉ nào trong năm này. Bấm một ngày trên lịch hoặc “+ Thêm ngày nghỉ” để thêm.</p>
              ) : (
                /* Cùng kiểu thẻ với trang Cấu hình (chấm màu ngày nghỉ thay cho ô biểu tượng), mỗi thẻ 3 dòng: tên · ngày · dài bao lâu, thẳng hàng giữa các thẻ */
                <div className={settingsStyles.grid}>
                  {yearHolidays.map((holiday) => (
                    <button
                      key={holiday.id}
                      type="button"
                      className={`${settingsStyles.card} ${styles.holidayCard}`}
                      onClick={() => setEditing({ holiday })}
                      aria-label={`Sửa ngày nghỉ ${holiday.name}`}
                    >
                      <i className={styles.holidayDot} aria-hidden="true" />
                      <strong className={settingsStyles.title}>{holiday.name}</strong>
                      {holidaySpanLines(holiday).map((line) => (
                        <span key={line} className={settingsStyles.description}>
                          {line}
                        </span>
                      ))}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <HolidayDialog
        open={editing !== null}
        holiday={editing?.holiday ?? null}
        initialRange={editing && !editing.holiday ? editing.range : undefined}
        onClose={() => setEditing(null)}
        onSaved={(saved) => setYear(Number(saved.startDate.slice(0, 4)))}
        onRemove={(holiday) => {
          setEditing(null);
          setRemoving(holiday);
        }}
      />

      <Modal open={removing !== null} onClose={() => setRemoving(null)} title={`Xóa ngày nghỉ “${removing?.name ?? ''}”?`}>
        <div className={styles.dialogBody}>
          <p className={styles.dialogText}>Hạn xử lí của các đơn sẽ tính lại, coi những ngày này là ngày làm việc.</p>
          <div className={styles.dialogButtons}>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={() => void confirmRemove()} disabled={removeHoliday.isPending}>
              {removeHoliday.isPending ? 'Đang xóa…' : 'Xóa ngày nghỉ'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Chọn một khoảng ngày trên lịch bằng cách nhấn giữ một ô rồi kéo (qua được nhiều tháng).
 * Chuột: nhấn là bắt đầu chọn. Cảm ứng: giữ TOUCH_HOLD_MS mới bắt đầu (kéo sớm hơn là cuộn trang), đang chọn thì trang không cuộn.
 * Thả ra: gọi onPick với khoảng đã chọn; chạm nhẹ không giữ cũng gọi, khoảng một ngày. Ô ngày cần thuộc tính data-date.
 * @param onPick  nhận khoảng ngày khi thả ra
 * @returns       selecting: khoảng đang kéo (null = không kéo) · press: gắn vào onPointerDown của từng ô
 */
function useDateRangeDrag(onPick: (range: DateRange) => void) {
  const [selecting, setSelecting] = useState<DateRange | null>(null);
  // Ô bắt đầu kéo và ô đang ở trên; ô vừa chạm (cảm ứng, chưa đủ giữ); hẹn giờ giữ
  const dragRef = useRef<{ anchor: string; current: string } | null>(null);
  const touchRef = useRef<{ date: string; x: number; y: number } | null>(null);
  const holdTimerRef = useRef<number | undefined>(undefined);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });

  /**
   * Đổi ô đang kéo tới, vẽ lại khoảng chọn.
   * @param anchor   ô bắt đầu kéo
   * @param current  ô đang ở trên
   */
  const showDrag = (anchor: string, current: string) => {
    dragRef.current = { anchor, current };
    setSelecting(rangeOf(anchor, current));
  };

  // Theo dõi con trỏ trên cả trang: kéo tới ô nào, thả ra ở đâu (kéo qua tháng khác, ra ngoài lịch vẫn được)
  useEffect(() => {
    /** Bỏ hết: hết giữ, hết kéo. */
    const reset = () => {
      window.clearTimeout(holdTimerRef.current);
      touchRef.current = null;
      dragRef.current = null;
      setSelecting(null);
    };

    /** @param event  con trỏ di chuyển */
    const onPointerMove = (event: PointerEvent) => {
      // Cảm ứng chưa đủ thời gian giữ mà đã lệch: đang cuộn trang, không chọn
      const touch = touchRef.current;
      if (touch && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > TOUCH_SLOP_PX) {
        window.clearTimeout(holdTimerRef.current);
        touchRef.current = null;
        return;
      }

      // Đang kéo: ô dưới con trỏ là đầu bên kia của khoảng
      const drag = dragRef.current;
      if (!drag) return;
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-date]');
      const date = cell?.dataset.date;
      if (date && date !== drag.current) {
        dragRef.current = { anchor: drag.anchor, current: date };
        setSelecting(rangeOf(drag.anchor, date));
      }
    };

    /** Thả ra: đang kéo thì lấy khoảng đã chọn, chạm nhẹ (chưa đủ giữ) thì một ngày. */
    const onPointerUp = () => {
      const drag = dragRef.current;
      const touch = touchRef.current;
      reset();
      if (drag) onPickRef.current(rangeOf(drag.anchor, drag.current));
      else if (touch) onPickRef.current({ startDate: touch.date, endDate: touch.date });
    };

    /** @param event  ngón tay di chuyển: đang kéo chọn thì trang không cuộn */
    const onTouchMove = (event: TouchEvent) => {
      if (dragRef.current) event.preventDefault();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', reset);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', reset);
      document.removeEventListener('touchmove', onTouchMove);
      window.clearTimeout(holdTimerRef.current);
    };
  }, []);

  /**
   * Nhấn xuống một ô: chuột thì bắt đầu chọn ngay, cảm ứng thì chờ giữ đủ lâu.
   * @param event  sự kiện nhấn
   * @param date   ngày của ô
   */
  const press = (event: ReactPointerEvent<HTMLButtonElement>, date: string) => {
    if (event.button !== 0) return;
    // Bỏ capture ngầm của màn hình cảm ứng, để elementFromPoint thấy ô dưới ngón tay
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.pointerType === 'mouse') {
      event.preventDefault();
      showDrag(date, date);
      return;
    }
    touchRef.current = { date, x: event.clientX, y: event.clientY };
    holdTimerRef.current = window.setTimeout(() => {
      touchRef.current = null;
      showDrag(date, date);
    }, TOUCH_HOLD_MS);
  };

  return { selecting, press };
}

/**
 * Lịch một tháng: tên tháng, hàng thứ (Thứ Hai trước), các ô ngày.
 * Ô ngày nghỉ tô xanh (rê chuột hiện tên), Thứ Bảy, Chủ nhật tô xám, hôm nay có viền, khoảng đang kéo chọn có nền xanh nhạt.
 * Chuột, chạm: theo useDateRangeDrag; bàn phím (Enter, Space trên một ô) thì như bấm ô đó.
 * @param year           năm
 * @param month          tháng 1–12
 * @param today          hôm nay 'YYYY-MM-DD'
 * @param holidayByDate  ngày nghỉ của từng ngày
 * @param selecting      khoảng đang kéo chọn; null = không kéo
 * @param onPressDate    nhấn xuống một ô (bắt đầu giữ / kéo)
 * @param onOpenDate     bấm một ô bằng bàn phím
 * @returns              khối lịch tháng
 */
function MonthCalendar({
  year,
  month,
  today,
  holidayByDate,
  selecting,
  onPressDate,
  onOpenDate,
}: {
  year: number;
  month: number;
  today: string;
  holidayByDate: ReadonlyMap<string, Holiday>;
  selecting: DateRange | null;
  onPressDate: (event: ReactPointerEvent<HTMLButtonElement>, date: string) => void;
  onOpenDate: (date: string) => void;
}) {
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = mondayFirstWeekday(dateOf(year, month, 1));

  return (
    <div className={styles.month}>
      <h3 className={styles.monthTitle}>Tháng {month}</h3>
      <div className={styles.monthGrid} role="group" aria-label={`Tháng ${month} năm ${year}`}>
        {WEEKDAY_SHORT.map((weekday, index) => (
          <span key={weekday} className={`${styles.weekday} ${index >= 5 ? styles.weekendLabel : ''}`} aria-hidden="true">
            {weekday}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length: dayCount }, (_, index) => {
          const date = dateOf(year, month, index + 1);
          const holiday = holidayByDate.get(date);
          const isWeekend = !isWorkingDay(date, NO_HOLIDAYS);
          const isSelecting = selecting !== null && selecting.startDate <= date && date <= selecting.endDate;
          const className = [
            styles.day,
            holiday ? styles.holiday : isWeekend ? styles.weekend : '',
            date === today ? styles.today : '',
            isSelecting ? styles.selecting : '',
          ].join(' ');
          const label = `${WEEKDAY_LABEL[mondayFirstWeekday(date) + 1]} ${formatDate(date)}${holiday ? `, ${holiday.name}` : isWeekend ? ', nghỉ cuối tuần' : ''}`;
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              className={className}
              title={holiday?.name}
              aria-label={label}
              onPointerDown={(event) => onPressDate(event, date)}
              // Chuột, chạm đã xử lí ở onPointerDown; chỉ bàn phím (detail = 0) mới mở ở đây
              onClick={(event) => event.detail === 0 && onOpenDate(date)}
              onContextMenu={(event) => event.preventDefault()}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
