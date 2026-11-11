/* Ô nhập ngày luôn hiện dạng ngày/tháng/năm (dd/mm/yyyy), không theo ngôn ngữ của trình duyệt như <input type="date">.
   Gõ tay được (tự chèn "/"), hoặc bấm biểu tượng lịch để chọn trên lịch của trình duyệt. */
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { formatDate, isIsoDate, maskDateInput, parseDisplayDate } from '../lib/format';
import styles from './DateInput.module.css';

interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Ngày dạng 'YYYY-MM-DD'; chuỗi khác (vd ngày gõ dở) thì hiện nguyên như vậy */
  value: string;
  /** Gọi mỗi lần đổi: ngày đủ và có thật thì truyền dạng 'YYYY-MM-DD', còn lại truyền chữ đang gõ (rỗng khi xóa hết) */
  onValueChange: (nextValue: string) => void;
}

/**
 * Chữ hiện trong ô cho một giá trị.
 * @param value  ngày 'YYYY-MM-DD' hoặc chữ đang gõ
 * @returns      ngày dạng 'DD/MM/YYYY', hoặc chính chữ đang gõ
 */
function displayTextOf(value: string): string {
  return isIsoDate(value) ? formatDate(value) : value;
}

/**
 * Ô nhập ngày dd/mm/yyyy kèm nút mở lịch.
 * @param props  xem DateInputProps; các thuộc tính khác (aria-*, className, disabled…) gắn vào ô gõ
 * @returns      ô gõ ngày và nút lịch
 */
export function DateInput({ value, onValueChange, className, disabled, ...inputProps }: DateInputProps) {
  const [typedText, setTypedText] = useState(() => displayTextOf(value));
  const pickerRef = useRef<HTMLInputElement>(null);

  // Giá trị đổi từ bên ngoài (chọn trên lịch, xóa bộ lọc…) thì hiện lại cho khớp; ngày gõ dở thì giữ nguyên chữ đang gõ
  useEffect(() => {
    setTypedText((currentText) => {
      if (isIsoDate(value)) return formatDate(value);
      if (value === '' && parseDisplayDate(currentText)) return '';
      return currentText;
    });
  }, [value]);

  /**
   * Gõ tay: chèn "/", rồi báo giá trị mới.
   * @param inputText  chữ trong ô sau khi gõ
   */
  const changeTypedText = (inputText: string) => {
    const maskedText = maskDateInput(inputText);
    setTypedText(maskedText);
    onValueChange(parseDisplayDate(maskedText) ?? maskedText);
  };

  /** Mở lịch của trình duyệt (trình duyệt cũ không có showPicker thì đưa con trỏ vào ô lịch ẩn). */
  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
    }
  };

  return (
    <span className={styles.wrap}>
      <input
        {...inputProps}
        className={className}
        disabled={disabled}
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        autoComplete="off"
        value={typedText}
        onChange={(event) => changeTypedText(event.target.value)}
      />
      <button type="button" className={styles.calendarButton} aria-label="Chọn ngày trên lịch" title="Chọn ngày trên lịch" disabled={disabled} onClick={openPicker}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      </button>
      {/* Ô ngày gốc của trình duyệt, ẩn đi, chỉ để mở lịch */}
      <input
        ref={pickerRef}
        type="date"
        className={styles.picker}
        tabIndex={-1}
        aria-hidden="true"
        value={isIsoDate(value) ? value : ''}
        onChange={(event) => event.target.value && onValueChange(event.target.value)}
      />
    </span>
  );
}
