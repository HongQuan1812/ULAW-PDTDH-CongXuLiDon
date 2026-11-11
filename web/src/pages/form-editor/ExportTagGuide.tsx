/* Hai mục dưới danh sách mẫu trong khung "Mẫu xuất file" (như tplCardHtml() của artifact/js/print-templates.js):
   - "Cách tạo một mẫu": 3 bước và ví dụ trước / sau;
   - "Bảng mã": mã câu trả lời của từng câu hỏi và mã chung, mỗi mã một dòng (Gõ vào file Word · Sẽ được điền bằng · Ví dụ).
   Bấm vào mã để sao chép; câu hỏi dạng bảng có bảng mẫu một dòng (vòng lặp) và nút sao chép để dán vào Word thành bảng thật. */
import { Fragment } from 'react';
import { COMMON_EXPORT_TAG_GROUPS, ROW_NUMBER_TAG, type ExportData, type ExportValue, type QuestionExportTag } from '@ulaw/shared';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import styles from './ExportTemplatesPanel.module.css';

/** Giá trị điền theo loại câu hỏi, ghi thêm sau "Câu trả lời" (như QKIND của bản mẫu). */
const ANSWER_KIND: Partial<Record<QuestionExportTag['type'], string>> = {
  check: 'các lựa chọn nối bằng dấu phẩy',
  file: 'tên các tệp đã tải lên',
  date: 'dạng dd/mm/yyyy',
};

/**
 * Sao chép một đoạn chữ, báo bằng toast; trình duyệt không cho sao chép thì báo mã để gõ tay.
 * @param text   chữ cần sao chép
 * @param toast  hàm báo
 */
async function copyText(text: string, toast: ReturnType<typeof useToast>) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Đã sao chép ${text}`, 'success');
  } catch {
    toast(`Mã: ${text}`, 'info');
  }
}

/**
 * Sao chép bảng mẫu của câu hỏi dạng bảng: dạng HTML để dán vào Word thành bảng thật, kèm dạng chữ (cách nhau bằng Tab).
 * @param question  câu hỏi dạng bảng
 * @param toast     hàm báo
 */
async function copyLoopTable(question: QuestionExportTag, toast: ReturnType<typeof useToast>) {
  const columns = question.columns ?? [];
  const cells = [`{#${question.tag}}{${ROW_NUMBER_TAG}}`, ...columns.map((column, i) => `{${column.tag}}${i === columns.length - 1 ? `{/${question.tag}}` : ''}`)];
  const headers = ['STT', ...columns.map((column) => column.label)];
  const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html =
    '<table border="1" style="border-collapse:collapse">' +
    `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>` +
    `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr></table>`;
  const text = `${headers.join('\t')}\n${cells.join('\t')}`;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) }),
    ]);
    toast('Đã sao chép bảng mẫu — dán (Ctrl+V) vào file Word', 'success');
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      toast('Đã sao chép bảng mẫu', 'success');
    } catch {
      toast('Trình duyệt không cho sao chép, hãy gõ tay theo bảng mẫu', 'info');
    }
  }
}

/**
 * Nút mã: bấm để sao chép, vd {ho_ten}.
 * @param tag  mã (không có ngoặc); có thể kèm dấu #, / của vòng lặp
 * @returns    nút
 */
function CodeChip({ tag }: { tag: string }) {
  const toast = useToast();
  const code = `{${tag}}`;
  return (
    <button type="button" className={styles.codeChip} title="Bấm để sao chép" onClick={() => void copyText(code, toast)}>
      {code}
    </button>
  );
}

/**
 * Ô ví dụ: giá trị điền của mã; trống thì ghi "(trống)".
 * @param value  giá trị ví dụ
 * @returns      chữ trong ô
 */
function ExampleValue({ value }: { value: ExportValue | undefined }) {
  if (value === undefined || value === '' || Array.isArray(value)) return <span className={styles.exampleEmpty}>(trống)</span>;
  return <>{String(value)}</>;
}

/**
 * Một dòng của Bảng mã.
 * @param tag      mã
 * @param meaning  sẽ được điền bằng gì
 * @param example  giá trị ví dụ
 * @returns        dòng bảng
 */
function TagRow({ tag, meaning, example }: { tag: string; meaning: string; example: ExportValue | undefined }) {
  return (
    <tr>
      <td>
        <CodeChip tag={tag} />
      </td>
      <td>{meaning}</td>
      <td className={styles.example}>
        <ExampleValue value={example} />
      </td>
    </tr>
  );
}

/**
 * Độ rộng các cột và đầu bảng của Bảng mã. Mọi nhóm mã dùng chung độ rộng cột, nên các cột thẳng hàng giữa các nhóm.
 * @returns  colgroup và thead
 */
function TagTableHead() {
  return (
    <>
      <colgroup>
        <col className={styles.tagColumn} />
        <col className={styles.meaningColumn} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Gõ vào file Word</th>
          <th>Sẽ được điền bằng</th>
          <th>Ví dụ</th>
        </tr>
      </thead>
    </>
  );
}

/**
 * Các dòng của một câu hỏi trong Bảng mã: câu thường một dòng; câu dạng bảng có bảng mẫu, mã stt, mã cột, số dòng, tổng cột.
 * @param question     mã của câu hỏi
 * @param exampleData  dữ liệu ví dụ
 * @returns            các dòng bảng
 */
function QuestionTagRows({ question, exampleData }: { question: QuestionExportTag; exampleData: ExportData }) {
  const toast = useToast();

  // Câu thường: một dòng mã câu trả lời
  if (!question.columns) {
    const kind = ANSWER_KIND[question.type];
    return (
      <>
        <tr className={styles.questionGroup}>
          <td colSpan={3}>{question.label}</td>
        </tr>
        <TagRow tag={question.tag} meaning={`Câu trả lời${kind ? ` (${kind})` : ''}`} example={exampleData[question.tag]} />
      </>
    );
  }

  // Câu dạng bảng: bảng mẫu một dòng có vòng lặp, rồi mã trong và ngoài vòng lặp
  const columns = question.columns;
  const rowName = question.rowName || 'dòng';
  const firstRow = (Array.isArray(exampleData[question.tag]) ? (exampleData[question.tag] as Array<Record<string, string | number>>)[0] : undefined) ?? {};
  return (
    <>
      <tr className={styles.questionGroup}>
        <td colSpan={3}>
          {question.label} <span className={styles.kind}>— câu hỏi dạng bảng</span>
        </td>
      </tr>
      <tr>
        {/* ô trải hết 3 cột; nội dung bọc trong div, vì đặt display:grid lên td thì nó không còn là ô bảng */}
        <td colSpan={3}>
          <div className={styles.loopBox}>
            <p>
              Trong Word, tạo bảng có <b>một dòng mẫu</b> như dưới đây. Khi xuất file, dòng này tự nhân lên theo số {rowName} trong đơn.{' '}
              <b className={styles.loop}>{`{#${question.tag}}`}</b> ở ô đầu và <b className={styles.loop}>{`{/${question.tag}}`}</b> ở ô cuối đánh dấu dòng mẫu.
            </p>
            <div className={styles.wordTableScroll}>
              <table className={styles.wordTable}>
                <tbody>
                  <tr>
                    <th>STT</th>
                    {columns.map((column) => (
                      <th key={column.tag}>{column.label}</th>
                    ))}
                  </tr>
                  <tr>
                    <td>
                      <b className={styles.loop}>{`{#${question.tag}}`}</b>
                      {`{${ROW_NUMBER_TAG}}`}
                    </td>
                    {columns.map((column, i) => (
                      <td key={column.tag}>
                        {`{${column.tag}}`}
                        {i === columns.length - 1 && <b className={styles.loop}>{`{/${question.tag}}`}</b>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <Button className={styles.smallButton} onClick={() => void copyLoopTable(question, toast)}>
              Sao chép bảng mẫu để dán vào Word
            </Button>
          </div>
        </td>
      </tr>
      <TagRow tag={ROW_NUMBER_TAG} meaning="Số thứ tự (đặt trong vòng lặp)" example={firstRow[ROW_NUMBER_TAG]} />
      {columns.map((column) => (
        <TagRow key={column.tag} tag={column.tag} meaning={`Cột “${column.label}” (đặt trong vòng lặp)`} example={firstRow[column.tag]} />
      ))}
      <TagRow tag={`so_${question.tag}`} meaning={`Số ${rowName} trong bảng (đặt ngoài vòng lặp)`} example={exampleData[`so_${question.tag}`]} />
      {columns
        .filter((column) => column.sum)
        .map((column) => (
          <TagRow
            key={`tong_${column.tag}`}
            tag={`tong_${column.tag}`}
            meaning={`Tổng cột “${column.label}” (đặt ngoài vòng lặp)`}
            example={exampleData[`tong_${column.tag}`]}
          />
        ))}
    </>
  );
}

interface ExportTagGuideProps {
  /** Mã của các câu hỏi đang soạn */
  questionTags: QuestionExportTag[];
  /** Dữ liệu cho cột Ví dụ */
  exampleData: ExportData;
  /** Ví dụ lấy từ đơn nào; null = dữ liệu mẫu */
  exampleFormCode: string | null;
}

/**
 * Các dòng ví dụ của "Cách tạo một mẫu": mỗi dòng một kiểu định dạng của mã (thường, in đậm, in nghiêng, cỡ chữ lớn).
 * @param exampleData  dữ liệu ví dụ (đơn mới nhất hoặc dữ liệu mẫu)
 * @returns            format: tên định dạng · lead: chữ đứng trước mã (để thường) · tag: mã · value: chữ điền vào
 *                     · className: định dạng của mã, và cũng là của chữ điền vào
 */
function formatExamples(exampleData: ExportData) {
  const valueOf = (tag: string, fallback: string) => String(exampleData[tag] || fallback);
  return [
    { format: 'Chữ thường', lead: 'Họ và tên: ', tag: 'ho_ten', value: valueOf('ho_ten', 'Nguyễn Văn A'), className: '' },
    { format: 'In đậm', lead: 'MSSV: ', tag: 'mssv', value: valueOf('mssv', '2253801010001'), className: styles.demoBold },
    { format: 'In nghiêng', lead: 'Lớp: ', tag: 'lop', value: valueOf('lop', '47-LTM-A'), className: styles.demoItalic },
    { format: 'Cỡ chữ lớn', lead: '', tag: 'loai_don', value: valueOf('loai_don', 'Xét miễn môn'), className: styles.demoLarge },
  ];
}

/**
 * Mục "Cách tạo một mẫu" và "Bảng mã" (các mục thu gọn được, mặc định đóng).
 * @param props  xem ExportTagGuideProps
 * @returns      hai mục
 */
export function ExportTagGuide({ questionTags, exampleData, exampleFormCode }: ExportTagGuideProps) {
  return (
    <>
      <details className={styles.guide}>
        <summary>Cách tạo một mẫu</summary>
        <div className={styles.guideBody}>
          <ol className={styles.steps}>
            <li>
              <b>Soạn file Word</b>
              <span>Gõ mã vào chỗ cần điền, lấy mã ở Bảng mã bên dưới.</span>
            </li>
            <li>
              <b>Tải lên</b>
              <span>Kéo thả file vào mục trên rồi bấm Lưu. Mã gõ sai sẽ có cảnh báo ngay dưới mẫu.</span>
            </li>
            <li>
              <b>Xuất file</b>
              <span>Ở chi tiết đơn, bấm “Xuất file” để nhận file Word đã điền sẵn.</span>
            </li>
          </ol>
          {/* Ví dụ: mỗi kiểu định dạng của mã một cặp "trong file mẫu → trong file xuất ra", tên định dạng ghi nhỏ phía trên */}
          <div className={styles.demo} aria-label="Ví dụ">
            <span className={styles.demoLabel}>Trong file mẫu</span>
            <span aria-hidden="true" />
            <span className={styles.demoLabel}>Trong file xuất ra</span>
            {formatExamples(exampleData).map((example) => (
              <Fragment key={example.tag}>
                <span className={styles.demoFormat}>{example.format}</span>
                <p>
                  {example.lead}
                  <span className={`${styles.code} ${example.className}`}>{`{${example.tag}}`}</span>
                </p>
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
                <p>
                  {example.lead}
                  <span className={example.className}>{example.value}</span>
                </p>
              </Fragment>
            ))}
          </div>
          {/* giá trị điền vào lấy định dạng của chỗ gõ mã, không tự in đậm */}
          <p className={styles.hint}>Chữ điền vào giữ đúng định dạng của mã trong file mẫu: mã in đậm thì chữ điền vào in đậm, mã cỡ 13 thì chữ cỡ 13.</p>
        </div>
      </details>

      <div className={styles.block}>
        <div className={styles.blockHead}>
          <h3>Bảng mã</h3>
        </div>
        <p className={styles.hint}>
          Bấm vào mã để sao chép, rồi dán vào file Word. Cột “Ví dụ” lấy {exampleFormCode ? `từ đơn ${exampleFormCode}` : 'từ dữ liệu mẫu'}.
        </p>
        <div className={styles.tagGroups}>
          <details className={styles.tagGroup}>
            <summary>Câu trả lời trong đơn</summary>
            {questionTags.length ? (
              <div className={styles.tagTableScroll}>
                <table className={styles.tagTable}>
                  <TagTableHead />
                  <tbody>
                    {/* khóa theo vị trí: lúc đang soạn hai câu có thể trùng mã (báo lỗi khi Lưu) */}
                    {questionTags.map((question, index) => (
                      <QuestionTagRows key={index} question={question} exampleData={exampleData} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.hint}>Loại đơn chưa có câu hỏi.</p>
            )}
          </details>
          {COMMON_EXPORT_TAG_GROUPS.map((group) => (
            <details key={group.title} className={styles.tagGroup}>
              <summary>{group.title}</summary>
              <div className={styles.tagTableScroll}>
                <table className={styles.tagTable}>
                  <TagTableHead />
                  <tbody>
                    {group.tags.map(({ tag, label }) => (
                      <TagRow key={tag} tag={tag} meaning={label} example={exampleData[tag]} />
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
