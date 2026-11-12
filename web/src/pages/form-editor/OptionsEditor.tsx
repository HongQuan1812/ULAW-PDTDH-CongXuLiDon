/* Khối soạn các lựa chọn (câu hỏi Chọn một / Chọn nhiều / Danh sách thả xuống, cột Chọn của bảng):
   mỗi lựa chọn một ô và nút bỏ, nút "+ Thêm lựa chọn". Thu gọn được như các mục của Bảng mã (Mẫu xuất file),
   để danh sách dài không chiếm chỗ. */
import type { ReactNode } from 'react';
import { GrowingTextarea } from '../../features/form-renderer/GrowingTextarea';
import { EditorIconButton } from './EditorIconButton';
import { removeAt, replaceAt } from './formTypeDraft';
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

/**
 * Khối soạn các lựa chọn, thu gọn được (mặc định mở). Còn một lựa chọn thì không bỏ được.
 * @param props  xem OptionsEditorProps
 * @returns      tiêu đề có mũi tên, mở ra thì có danh sách ô và nút "+ Thêm lựa chọn"
 */
export function OptionsEditor({ heading, mark, options, invalidOptionIndexes, optionLabel, onChange }: OptionsEditorProps) {
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
              className={styles.growing}
              value={option}
              aria-label={optionLabel(i + 1)}
              aria-invalid={invalidOptionIndexes.includes(i) || undefined}
              onValueChange={(nextOption) => onChange(replaceAt(options, i, nextOption))}
            />
            <EditorIconButton icon="remove" label="Xóa lựa chọn" disabled={options.length < 2} onClick={() => onChange(removeAt(options, i))} />
          </div>
        ))}
        <button type="button" className={styles.linkButton} onClick={() => onChange([...options, `Lựa chọn ${options.length + 1}`])}>
          + Thêm lựa chọn
        </button>
      </div>
    </details>
  );
}
