/* Khung chọn tệp dùng chung: bấm, Enter / phím cách, hoặc kéo thả tệp vào.
   Chỉ đưa tệp vừa chọn cho nơi dùng; giữ tệp, kiểm tra định dạng, tải lên là việc của nơi dùng.
   Dùng ở câu hỏi tải tệp của lá đơn và khung Mẫu xuất file của trình soạn. */
import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import styles from './FileDropZone.module.css';

interface FileDropZoneProps {
  /** Thuộc tính accept của hộp chọn tệp, vd '.pdf,application/pdf' */
  accept: string;
  /** Câu hướng dẫn nhỏ dưới dòng chính, vd 'PDF, ảnh — tối đa 10 MB/tệp' */
  hint: string;
  /** Gọi với các tệp vừa chọn hoặc kéo thả vào */
  onFiles: (chosenFiles: FileList) => void;
  /** Chọn được nhiều tệp một lần; mặc định true */
  multiple?: boolean;
  /** Tô đỏ (câu hỏi bắt buộc chưa có tệp) */
  invalid?: boolean;
  /** Id nhãn của khung */
  labelledBy?: string;
  /** Id các câu mô tả / câu báo lỗi của khung */
  describedBy?: string;
}

/**
 * Khung chọn tệp.
 * @param props  xem FileDropZoneProps
 * @returns      khung bấm / kéo thả và hộp chọn tệp ẩn
 */
export function FileDropZone({ accept, hint, onFiles, multiple = true, invalid, labelledBy, describedBy }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draggingOver, setDraggingOver] = useState(false);

  // Kéo tệp vào / ra khỏi khung
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingOver(true);
  };
  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingOver(false);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingOver(false);
    if (event.dataTransfer.files.length) onFiles(event.dataTransfer.files);
  };
  // Enter hoặc phím cách trên khung: mở hộp chọn tệp
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    inputRef.current?.click();
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`${styles.dropZone} ${draggingOver ? styles.dropZoneOver : ''} ${invalid ? styles.invalid : ''}`}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onClick={() => inputRef.current?.click()}
        onKeyDown={onKeyDown}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M12 17v-6" />
          <path d="m9 13 3-3 3 3" />
        </svg>
        <strong>Kéo thả tệp vào đây hoặc bấm để chọn</strong>
        <span>{hint}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        hidden
        accept={accept}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </>
  );
}
