/* Hộp "Chọn loại đơn", mở khi bấm "Nộp đơn mới" (như #nModal và renderNewPicker() trong artifact/js/application-form.js):
   các loại đơn đang nhận đơn, có ô tìm kiếm; chọn một loại thì sang trang nộp đơn của loại đó
   (của mình, hoặc thay cho người đang xem khi mở từ trang thông tin người khác). */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import type { OpenFormType } from '@ulaw/shared';
import { newFormForApplicantPath, newFormPath, type ReturnState } from '../../app/paths';
import { LoadError } from '../../components/LoadError';
import { Modal } from '../../components/Modal';
import { Highlight } from '../../components/table/Highlight';
import { SearchIcon } from '../../components/table/icons';
import { normalizeText } from '../../lib/search';
import tableStyles from '../../components/table/table.module.css';
import styles from './FormTypePicker.module.css';

interface FormTypePickerProps {
  open: boolean;
  onClose: () => void;
  /** Các loại đơn đang mở; undefined = chưa tải xong */
  formTypes: OpenFormType[] | undefined;
  /** Câu báo khi không tải được danh sách (đóng hộp rồi mở lại để tải lại); null = không lỗi */
  loadError: string | null;
  /** Nộp thay: id người nộp đơn; bỏ trống = đơn của mình */
  applicantId?: string;
  /** Tên trang đang mở hộp, hiện trên nút "‹ Quay lại …" của trang nộp đơn */
  previousPageLabel: string;
}

/**
 * Hộp chọn loại đơn. Mỗi lần mở là một lần mới (ô tìm kiếm trống, chọn sẵn loại đầu tiên).
 * @param props  xem FormTypePickerProps
 * @returns      hộp thoại
 */
export function FormTypePicker({ open, onClose, formTypes, loadError, applicantId, previousPageLabel }: FormTypePickerProps) {
  return (
    <Modal open={open} onClose={onClose} title="Chọn loại đơn" showCloseButton className={styles.modal}>
      {formTypes ? (
        <FormTypeList formTypes={formTypes} applicantId={applicantId} previousPageLabel={previousPageLabel} />
      ) : loadError ? (
        <LoadError message={`${loadError} Đóng hộp này rồi bấm “Nộp đơn mới” lại để tải lại.`} />
      ) : (
        <p className={styles.count}>Đang tải danh sách loại đơn…</p>
      )}
    </Modal>
  );
}

/**
 * Lọc loại đơn theo chữ tìm kiếm (tên, tiền tố, mô tả; không phân biệt dấu) rồi xếp theo tên.
 * @param formTypes  các loại đơn đang mở
 * @param query      chữ trong ô tìm kiếm
 * @returns          các loại đơn khớp, theo thứ tự tên kiểu tiếng Việt
 */
function matchFormTypes(formTypes: OpenFormType[], query: string): OpenFormType[] {
  const keyword = normalizeText(query.trim());
  return formTypes
    .filter(
      (formType) =>
        !keyword ||
        [formType.name, formType.prefix, formType.description ?? ''].some((text) => normalizeText(text).includes(keyword)),
    )
    .sort((first, second) => first.name.localeCompare(second.name, 'vi'));
}

/**
 * Ô tìm kiếm và danh sách loại đơn. Dùng phím ↑ ↓ để đổi loại đang chọn, Enter để mở form.
 * @param formTypes          các loại đơn đang mở
 * @param applicantId        nộp thay: id người nộp đơn; bỏ trống = đơn của mình
 * @param previousPageLabel  tên trang đang mở hộp (cho nút Quay lại của trang nộp đơn)
 * @returns                  ô tìm kiếm, danh sách, dòng đếm số loại đơn
 */
function FormTypeList({
  formTypes,
  applicantId,
  previousPageLabel,
}: { formTypes: OpenFormType[] } & Pick<FormTypePickerProps, 'applicantId' | 'previousPageLabel'>) {
  const navigate = useNavigate();
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const matches = useMemo(() => matchFormTypes(formTypes, query), [formTypes, query]);
  const shownIndex = Math.min(selectedIndex, Math.max(0, matches.length - 1));
  const optionId = (index: number) => `${listId}-option-${index}`;

  // Loại đang chọn luôn nằm trong vùng nhìn thấy của danh sách
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [shownIndex]);

  // Mở trang nộp đơn của loại đã chọn, của mình hoặc nộp thay (hộp thoại tự đóng khi rời trang)
  const start = (formType: OpenFormType) =>
    navigate(applicantId ? newFormForApplicantPath(applicantId, formType.id) : newFormPath(formType.id), {
      state: { previousPageLabel } satisfies ReturnState,
    });

  // ↑ ↓ đi vòng trong danh sách; Enter mở loại đang chọn
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!matches.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setSelectedIndex((shownIndex + step + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      start(matches[shownIndex]!);
    }
  };

  const countText = query.trim()
    ? `${matches.length} / ${formTypes.length} loại đơn đang nhận đơn`
    : `${formTypes.length} loại đơn đang nhận đơn`;

  return (
    <>
      <label className={tableStyles.search}>
        <SearchIcon />
        <input
          type="search"
          placeholder="Tìm theo tên, mã đơn, mô tả"
          aria-label="Tìm loại đơn"
          autoComplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={matches.length ? optionId(shownIndex) : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
      </label>

      <div className={styles.list} id={listId} ref={listRef} role="listbox" aria-label="Các loại đơn đang nhận đơn">
        {matches.length ? (
          matches.map((formType, index) => (
            <button
              key={formType.id}
              id={optionId(index)}
              type="button"
              role="option"
              aria-selected={index === shownIndex}
              tabIndex={-1}
              className={styles.option}
              onClick={() => start(formType)}
            >
              <span className={styles.optionTop}>
                <b>
                  <Highlight text={formType.name} query={query} />
                </b>
                <span className={styles.prefix}>
                  <Highlight text={formType.prefix} query={query} />
                </span>
              </span>
              {formType.description && (
                <span className={styles.description}>
                  <Highlight text={formType.description} query={query} />
                </span>
              )}
            </button>
          ))
        ) : (
          <p className={tableStyles.emptyNote}>
            {formTypes.length ? `Không có loại đơn nào khớp “${query.trim()}”.` : 'Hiện chưa có loại đơn nào đang nhận đơn.'}
          </p>
        )}
      </div>

      <p className={styles.count}>{countText}</p>
    </>
  );
}
