/* Khối soạn các lựa chọn (câu hỏi Chọn một / Chọn nhiều / Danh sách thả xuống, cột Chọn của bảng):
   mỗi lựa chọn một ô và nút bỏ, nút "+ Thêm lựa chọn". Thu gọn được như các mục của Bảng mã (Mẫu xuất file),
   để danh sách dài không chiếm chỗ.
   Soạn bằng bàn phím như danh sách gạch đầu dòng: Enter ở cuối ô thêm lựa chọn ngay dưới (Enter khi đang sửa giữa chữ thì không làm gì),
   Enter / Backspace ở ô trống thì bỏ ô đó,
   ↑ ↓ chuyển ô, dán nhiều dòng thì mỗi dòng một lựa chọn. */
import { useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { GrowingTextarea } from '../../features/form-renderer/GrowingTextarea';
import { EditorIconButton } from './EditorIconButton';
import { insertEmptyOption, pasteOptions, removeAt, replaceAt } from './formTypeDraft';
import styles from './FormTypeEditor.module.css';

interface OptionsEditorProps {
  /** tiêu đề, bấm vào để thu gọn / mở, vd "Các lựa chọn của cột 4" */
  heading: ReactNode;
  /** dấu trước mỗi ô: tròn (Chọn một), vuông (Chọn nhiều), ▾ (Danh sách thả xuống, cột Chọn) */
  mark: 'radio' | 'check' | 'select';
  /** các lựa chọn */
  options: string[];
  /** thứ tự các lựa chọn đang báo lỗi (để tô đỏ) */
  invalidOptionIndexes: number[];
  /** tên ô cho trình đọc màn hình, vd (1) → "Lựa chọn 1 của cột 4" */
  optionLabel: (optionNumber: number) => string;
  /** gọi với danh sách lựa chọn đã sửa */
  onChange: (nextOptions: string[]) => void;
}

/** Ô cần đưa con trỏ vào sau khi danh sách đổi: thứ tự ô, con trỏ ở đầu hay cuối chữ. */
interface PendingFocus {
  index: number;
  caret: 'start' | 'end';
}

/**
 * Khối soạn các lựa chọn, thu gọn được (mặc định mở). Còn một lựa chọn thì không bỏ được.
 * @param props  xem OptionsEditorProps
 * @returns      tiêu đề có mũi tên, mở ra thì có danh sách ô và nút "+ Thêm lựa chọn"
 */
export function OptionsEditor({ heading, mark, options, invalidOptionIndexes, optionLabel, onChange }: OptionsEditorProps) {
  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const pendingFocusRef = useRef<PendingFocus | null>(null);

  // Danh sách vừa đổi do bàn phím / nút thêm: đưa con trỏ vào ô đã hẹn
  useLayoutEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    focusOption(pending);
  }, [options]);

  /**
   * Đưa con trỏ vào một ô lựa chọn.
   * @param target  ô và vị trí con trỏ
   */
  function focusOption({ index, caret }: PendingFocus): void {
    const input = inputRefs.current[index];
    if (!input) return;
    input.focus();
    const position = caret === 'start' ? 0 : input.value.length;
    input.setSelectionRange(position, position);
  }

  /**
   * Đổi danh sách rồi đưa con trỏ vào một ô (sau khi vẽ lại).
   * @param nextOptions  danh sách mới
   * @param focus        ô cần đưa con trỏ vào
   */
  function changeAndFocus(nextOptions: string[], focus: PendingFocus): void {
    pendingFocusRef.current = focus;
    onChange(nextOptions);
  }

  /**
   * Phím trong ô lựa chọn: Enter, Backspace, ↑ ↓.
   * @param event  sự kiện phím
   * @param index  thứ tự ô
   */
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, index: number): void {
    // Đang gõ dấu bằng bộ gõ (IME) thì để bộ gõ xử lí
    if (event.nativeEvent.isComposing) return;
    const input = event.currentTarget;
    const isEmpty = input.value.trim() === '';
    const caretAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const caretAtEnd = input.selectionStart === input.value.length;

    // Enter ở ô trống: bỏ ô (còn một ô thì thôi); Enter ở cuối chữ: thêm lựa chọn trống ngay dưới;
    // Enter khi con trỏ ở giữa chữ (người dùng vừa sửa xong, bấm Enter như xác nhận): không làm gì
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (isEmpty) {
        if (options.length > 1) changeAndFocus(removeAt(options, index), { index: Math.max(0, index - 1), caret: 'end' });
        return;
      }
      if (caretAtEnd) changeAndFocus(insertEmptyOption(options, index), { index: index + 1, caret: 'start' });
      return;
    }

    // Backspace ở ô trống: bỏ ô, con trỏ về cuối ô trên
    if (event.key === 'Backspace' && input.value === '' && options.length > 1) {
      event.preventDefault();
      changeAndFocus(removeAt(options, index), { index: Math.max(0, index - 1), caret: 'end' });
      return;
    }

    // ↑ ở đầu chữ / ↓ ở cuối chữ: sang ô trên / ô dưới
    if (event.key === 'ArrowUp' && caretAtStart && index > 0) {
      event.preventDefault();
      focusOption({ index: index - 1, caret: 'end' });
    } else if (event.key === 'ArrowDown' && caretAtEnd && index < options.length - 1) {
      event.preventDefault();
      focusOption({ index: index + 1, caret: 'end' });
    }
  }

  /**
   * Dán chữ nhiều dòng: mỗi dòng một lựa chọn; một dòng thì dán như thường.
   * @param event  sự kiện dán
   * @param index  thứ tự ô
   */
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>, index: number): void {
    const input = event.currentTarget;
    const pasted = pasteOptions(options, index, input.selectionStart, input.selectionEnd, event.clipboardData.getData('text'));
    if (!pasted) return;
    event.preventDefault();
    changeAndFocus(pasted.options, { index: pasted.lastIndex, caret: 'end' });
  }

  return (
    <details className={styles.optionsGroup} open>
      {/* bọc tiêu đề trong một thẻ để dấu * sát chữ (summary xếp mũi tên và tiêu đề cách nhau); tổng số lựa chọn ở cuối hàng */}
      <summary className={styles.subLabel}>
        <span>{heading}</span>
        <span className={styles.optionsCount}>{options.length} lựa chọn</span>
      </summary>
      <div className={styles.options}>
        {options.map((option, i) => (
          <div key={i} className={styles.option}>
            <span className={`${styles.optionMark} ${styles[`optionMark_${mark}`] ?? ''}`} aria-hidden="true" />
            <GrowingTextarea
              ref={(input: HTMLTextAreaElement | null) => {
                inputRefs.current[i] = input;
              }}
              className={styles.growing}
              value={option}
              placeholder="Lựa chọn"
              aria-label={optionLabel(i + 1)}
              aria-invalid={invalidOptionIndexes.includes(i) || undefined}
              onValueChange={(nextOption) => onChange(replaceAt(options, i, nextOption))}
              onKeyDown={(event) => handleKeyDown(event, i)}
              onPaste={(event) => handlePaste(event, i)}
            />
            <EditorIconButton icon="remove" label="Xóa lựa chọn" disabled={options.length < 2} onClick={() => onChange(removeAt(options, i))} />
          </div>
        ))}
        {/* Nút thêm: thêm ô trống ở cuối và đưa con trỏ vào luôn */}
        <div className={styles.optionsFoot}>
          <button type="button" className={styles.linkButton} onClick={() => changeAndFocus([...options, ''], { index: options.length, caret: 'end' })}>
            + Thêm lựa chọn
          </button>
          <small className={styles.optionsKeys}>Enter ở cuối ô: thêm lựa chọn · Enter ở ô trống: bỏ ô</small>
        </div>
      </div>
    </details>
  );
}
