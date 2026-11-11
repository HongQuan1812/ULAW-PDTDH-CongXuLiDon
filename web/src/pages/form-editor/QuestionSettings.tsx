/* Cài đặt riêng theo loại câu hỏi trong trình soạn (như typeEditor() của artifact/js/forms-page.js):
   các lựa chọn (Chọn một / Chọn nhiều / Danh sách thả xuống), các cột của bảng, định dạng và dung lượng tệp.
   Loại câu hỏi khác không có cài đặt riêng. */
import { FORM_TYPE_ISSUE_TARGET, columnTag, type Question, type QuestionOf, type TableColumn } from '@ulaw/shared';
import { RequiredMark } from '../../components/Field';
import { GrowingTextarea } from '../../features/form-renderer/GrowingTextarea';
import { useDraftIssues } from './draftIssues';
import { EditorIconButton } from './EditorIconButton';
import { DEFAULT_MAX_MB, FILE_FORMAT_GROUPS, MAX_MB_LIMIT, removeAt, replaceAt } from './formTypeDraft';
import styles from './FormTypeEditor.module.css';

/** Tiêu đề khối cài đặt theo loại câu hỏi (như QSET_TITLE của bản mẫu). */
const SETTINGS_TITLE: Partial<Record<Question['type'], string>> = {
  radio: 'Các lựa chọn',
  check: 'Các lựa chọn',
  select: 'Các lựa chọn',
  table: 'Cài đặt bảng',
  file: 'Cài đặt tải tệp',
};

interface QuestionSettingsProps {
  question: Question;
  onChange: (nextQuestion: Question) => void;
}

/**
 * Khối cài đặt riêng của câu hỏi, nền nhạt viền đứt.
 * @param question  câu hỏi đang soạn
 * @param onChange  gọi với câu hỏi đã sửa
 * @returns         khối cài đặt; loại câu hỏi không có cài đặt riêng thì không hiện gì
 */
export function QuestionSettings({ question, onChange }: QuestionSettingsProps) {
  const title = SETTINGS_TITLE[question.type];
  if (!title) return null;
  const isChoice = question.type === 'radio' || question.type === 'check' || question.type === 'select';
  return (
    <div className={styles.settings}>
      {/* Tiêu đề khối; các lựa chọn không được để trống nên có dấu * */}
      <p className={styles.settingsTitle}>
        {title}
        {isChoice && <RequiredMark />}
      </p>
      {isChoice && (
        <ChoiceSettings question={question} onChange={onChange} />
      )}
      {question.type === 'table' && <TableSettings question={question} onChange={onChange} />}
      {question.type === 'file' && <FileSettings question={question} onChange={onChange} />}
    </div>
  );
}

/**
 * Các lựa chọn: mỗi lựa chọn một ô, có dấu chọn theo loại (tròn, vuông, ▾) và nút bỏ; còn một lựa chọn thì không bỏ được.
 * @param question  câu hỏi Chọn một / Chọn nhiều / Danh sách thả xuống
 * @param onChange  gọi với câu hỏi đã sửa
 * @returns         danh sách ô và nút "+ Thêm lựa chọn"
 */
function ChoiceSettings({ question, onChange }: { question: QuestionOf<'radio' | 'check' | 'select'>; onChange: (nextQuestion: Question) => void }) {
  const setOptions = (options: string[]) => onChange({ ...question, options });
  const invalidTargets = useDraftIssues();
  return (
    <div className={styles.options}>
      {question.options.map((option, i) => (
        <div key={i} className={styles.option}>
          <span className={`${styles.optionMark} ${styles[`optionMark_${question.type}`] ?? ''}`} aria-hidden="true" />
          <GrowingTextarea
            className={styles.growing}
            value={option}
            aria-label={`Lựa chọn ${i + 1}`}
            aria-invalid={invalidTargets.has(FORM_TYPE_ISSUE_TARGET.option(question.id, i)) || undefined}
            onValueChange={(nextOption) => setOptions(replaceAt(question.options, i, nextOption))}
          />
          <EditorIconButton
            icon="remove"
            label="Xóa lựa chọn"
            disabled={question.options.length < 2}
            onClick={() => setOptions(removeAt(question.options, i))}
          />
        </div>
      ))}
      <button type="button" className={styles.linkButton} onClick={() => setOptions([...question.options, `Lựa chọn ${question.options.length + 1}`])}>
        + Thêm lựa chọn
      </button>
    </div>
  );
}

/**
 * Cài đặt bảng: tên gọi mỗi dòng, rồi mỗi cột một hàng (tên, mô tả nhỏ, kiểu Chữ / Số, tính tổng, nút bỏ).
 * Dưới tên cột là mã của cột trong file Word (lấy theo tên cột).
 * Tên cột và mô tả dài thì tự xuống hàng như ô chữ trong bảng trả lời.
 * Chỉ cột Số mới tính tổng được; đổi sang Chữ thì bỏ tính tổng. Còn một cột thì không bỏ được.
 * @param question  câu hỏi Bảng nhiều dòng
 * @param onChange  gọi với câu hỏi đã sửa
 * @returns         khối cài đặt bảng
 */
function TableSettings({ question, onChange }: { question: QuestionOf<'table'>; onChange: (nextQuestion: Question) => void }) {
  const setColumns = (columns: TableColumn[]) => onChange({ ...question, columns });
  const changeColumn = (index: number, changes: Partial<TableColumn>) =>
    setColumns(replaceAt(question.columns, index, { ...question.columns[index]!, ...changes }));
  const invalidTargets = useDraftIssues();

  return (
    <div className={styles.tableSettings}>
      <label className={`${styles.subLabel} ${styles.rowName}`}>
        Tên gọi mỗi dòng
        <GrowingTextarea className={styles.growing} value={question.rowName} onValueChange={(rowName) => onChange({ ...question, rowName })} />
        <small>Hiện ở nút “+ Thêm …” và dòng tổng, vd “môn”</small>
      </label>

      <div className={`${styles.columnsHead} ${styles.subLabel}`} aria-hidden="true">
        <span>
          Cột
          <RequiredMark />
        </span>
        <span>Mô tả ngắn</span>
        <span>Kiểu</span>
        <span>Tính tổng</span>
        <span />
      </div>
      {question.columns.map((column, i) => (
        <div key={i} className={styles.column}>
          {/* Tên cột, mô tả dài thì tự xuống hàng; các ô cùng hàng trên cao bằng nhau.
              Mã của cột trong file Word nằm ở hàng dưới, ngay dưới ô tên cột */}
          <GrowingTextarea
            value={column.label}
            placeholder="Tên cột"
            aria-label={`Tên cột ${i + 1}`}
            aria-invalid={invalidTargets.has(FORM_TYPE_ISSUE_TARGET.column(question.id, i)) || undefined}
            onValueChange={(label) => changeColumn(i, { label })}
          />
          <code className={styles.columnCode} title="Mã của cột trong file Word">{`{${columnTag(column)}}`}</code>
          <GrowingTextarea value={column.sub ?? ''} placeholder="Mô tả ngắn" aria-label={`Mô tả ngắn cột ${i + 1}`} onValueChange={(sub) => changeColumn(i, { sub })} />
          <select
            value={column.type}
            aria-label={`Kiểu cột ${i + 1}`}
            onChange={(event) => {
              const type = event.target.value as TableColumn['type'];
              changeColumn(i, type === 'number' ? { type } : { type, sum: undefined, sumLabel: undefined });
            }}
          >
            <option value="text">Chữ</option>
            <option value="number">Số</option>
          </select>
          <label className={styles.columnSum}>
            <input
              type="checkbox"
              checked={Boolean(column.sum)}
              disabled={column.type !== 'number'}
              aria-label={`Tính tổng cột ${i + 1}`}
              onChange={(event) => changeColumn(i, { sum: event.target.checked })}
            />
          </label>
          <EditorIconButton icon="remove" label="Xóa cột" disabled={question.columns.length < 2} onClick={() => setColumns(removeAt(question.columns, i))} />
        </div>
      ))}
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => setColumns([...question.columns, { label: `Cột ${question.columns.length + 1}`, type: 'text' }])}
      >
        + Thêm cột
      </button>
    </div>
  );
}

/**
 * Cài đặt tải tệp: các nhóm định dạng cho phép (ô đánh dấu) và dung lượng tối đa mỗi tệp (1–50 MB).
 * @param question  câu hỏi Tải tệp
 * @param onChange  gọi với câu hỏi đã sửa
 * @returns         hai cột: Định dạng cho phép | Tối đa mỗi tệp (MB)
 */
function FileSettings({ question, onChange }: { question: QuestionOf<'file'>; onChange: (nextQuestion: Question) => void }) {
  /** Đánh dấu / bỏ một nhóm định dạng; giữ thứ tự đuôi tệp theo thứ tự các nhóm. */
  const toggleFormats = (extensions: readonly string[], checked: boolean) => {
    const accepted = new Set(question.accept);
    extensions.forEach((extension) => (checked ? accepted.add(extension) : accepted.delete(extension)));
    const ordered = FILE_FORMAT_GROUPS.flatMap(([groupExtensions]) => groupExtensions).filter((extension) => accepted.has(extension));
    onChange({ ...question, accept: ordered });
  };
  const formatsInvalid = useDraftIssues().has(FORM_TYPE_ISSUE_TARGET.fileFormats(question.id));

  return (
    <div className={styles.fileSettings}>
      <div className={styles.fileColumn}>
        <span className={styles.subLabel}>
          Định dạng cho phép
          <RequiredMark />
        </span>
        <div className={`${styles.formats} ${formatsInvalid ? styles.formatsInvalid : ''}`}>
          {FILE_FORMAT_GROUPS.map(([extensions, label]) => (
            <label key={label} className={styles.check}>
              <input
                type="checkbox"
                checked={extensions.every((extension) => question.accept.includes(extension))}
                aria-invalid={formatsInvalid || undefined}
                onChange={(event) => toggleFormats(extensions, event.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <label className={`${styles.fileColumn} ${styles.subLabel}`}>
        Tối đa mỗi tệp (MB)
        <input
          type="number"
          min={1}
          max={MAX_MB_LIMIT}
          value={question.maxMB}
          onChange={(event) => onChange({ ...question, maxMB: Math.min(MAX_MB_LIMIT, Math.max(1, Number(event.target.value) || DEFAULT_MAX_MB)) })}
        />
      </label>
    </div>
  );
}
