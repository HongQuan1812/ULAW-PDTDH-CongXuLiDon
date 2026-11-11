/* Ô nhập chữ tự cao lên khi chữ dài phải xuống hàng, không bị che chữ (ô chữ trong bảng, câu Trả lời ngắn, Đoạn văn, ô chữ của trình soạn). */
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/** Thuộc tính của ô: như <textarea>, nhưng giá trị là chữ và đổi giá trị nhận thẳng chữ mới. */
type GrowingTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'rows'> & {
  value: string;
  onValueChange: (text: string) => void;
  /** true: cho Enter xuống dòng và giữ các dòng (vd câu Đoạn văn); mặc định một đoạn liền */
  multiline?: boolean;
};

/**
 * Đặt chiều cao tối thiểu của ô vừa đủ chữ bên trong.
 * Dùng chiều cao tối thiểu (không phải chiều cao) để CSS vẫn cho ô cao hơn được, vd cao bằng ô dài nhất cùng dòng trong bảng.
 * @param textarea  ô cần chỉnh
 */
function fitHeight(textarea: HTMLTextAreaElement): void {
  // Đo chiều cao chữ khi ô co về cỡ nhỏ nhất CSS cho phép (vd 36px trong bảng)
  textarea.style.minHeight = '';
  textarea.style.height = 'auto';
  const borderHeight = textarea.offsetHeight - textarea.clientHeight;
  const contentHeight = Math.max(textarea.offsetHeight, textarea.scrollHeight + borderHeight);

  // Trả chiều cao cho CSS, chỉ giữ mức tối thiểu
  textarea.style.height = '';
  textarea.style.minHeight = `${contentHeight}px`;
}

/**
 * Ô nhập chữ tự xuống hàng và cao lên theo nội dung, không có thanh cuộn, không kéo giãn bằng tay.
 * Mặc định giá trị là một đoạn liền: không cho Enter xuống dòng, dán chữ có nhiều dòng thì nối lại bằng dấu cách.
 * @param value          chữ đang nhập
 * @param onValueChange  nhận chữ mới mỗi khi người dùng gõ
 * @param multiline      true: cho Enter xuống dòng, giữ nguyên các dòng
 * @returns              thẻ <textarea>
 */
export function GrowingTextarea({ value, onValueChange, multiline = false, onKeyDown, ...textareaProps }: GrowingTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Chỉnh chiều cao khi chữ đổi
  useLayoutEffect(() => {
    if (textareaRef.current) fitHeight(textareaRef.current);
  }, [value]);

  // Chỉnh chiều cao khi ô hẹp lại / rộng ra (vd đổi cỡ cửa sổ, ẩn hiện khung Thông tin đơn)
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || typeof ResizeObserver === 'undefined') return;
    let lastWidth = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth === lastWidth) return;
      lastWidth = textarea.clientWidth;
      fitHeight(textarea);
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !multiline) event.preventDefault();
        onKeyDown?.(event);
      }}
      onChange={(event) => onValueChange(multiline ? event.target.value : event.target.value.replace(/\s*\n\s*/g, ' '))}
      {...textareaProps}
    />
  );
}
