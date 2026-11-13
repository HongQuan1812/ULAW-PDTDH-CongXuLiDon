/* Hai mục hướng dẫn trong khung "Mẫu xuất file đơn" / "Mẫu xuất file thống kê":
   - "Cách tạo một mẫu" (ExportHowTo, ngay trên khung chọn file, thu gọn được): 3 bước và ví dụ trước / sau;
   - "Bảng mã" (ExportTagGuide, dưới danh sách mẫu): mã câu trả lời của từng câu hỏi và mã chung, mỗi mã một dòng (Gõ vào file Word / Excel · Sẽ được điền bằng).
   Bấm vào mã để sao chép.
   Mẫu Word: ví dụ theo kiểu định dạng; câu hỏi dạng bảng có bảng mẫu một dòng (vòng lặp) và nút sao chép để dán vào Word thành bảng thật.
   Mẫu Excel: có nút "Tải file mẫu có sẵn" (đã có đầu cột, mã mọi câu hỏi). Không có vòng lặp: hàng có mã của đơn (hàng mẫu) nhân lên
   mỗi đơn một hàng, câu hỏi dạng bảng gộp vào một ô; mã tiêu đề file chỉ điền một lần. */
import { Fragment, useState, type ReactNode } from 'react';
import {
  COMMON_EXPORT_TAG_GROUPS,
  ROW_NUMBER_TAG,
  STATS_SUMMARY_TAGS,
  DOCX_CONTENT_TYPE,
  XLSX_CONTENT_TYPE,
  createFormStarterDocx,
  createStatsStarterXlsx,
  type ExportTemplatePurpose,
  type FormSection,
  type QuestionExportTag,
} from '@ulaw/shared';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { FilePreview, type PreviewFile } from '../../features/file-preview/FilePreview';
import { saveToDevice } from '../../lib/saveToDevice';
import styles from './ExportTemplatesPanel.module.css';

/** Giá trị điền theo loại câu hỏi, ghi thêm sau "Câu trả lời". */
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
 * Sao chép bảng mẫu của câu hỏi dạng bảng để dán vào Word.
 * @param question  câu hỏi dạng bảng
 * @param toast     hàm báo
 */
async function copyLoopTable(question: QuestionExportTag, toast: ReturnType<typeof useToast>) {
  const columns = question.columns ?? [];
  const cells = [`{#${question.tag}}{${ROW_NUMBER_TAG}}`, ...columns.map((column, i) => `{${column.tag}}${i === columns.length - 1 ? `{/${question.tag}}` : ''}`)];
  const headers = ['STT', ...columns.map((column) => column.label)];
  await copyTable(headers, cells, 'Word', toast);
}

/**
 * Sao chép một bảng hai hàng (đầu cột, hàng mã): dạng HTML để dán thành bảng thật, kèm dạng chữ (cách nhau bằng Tab).
 * @param headers  đầu cột
 * @param cells    các ô của hàng mã
 * @param appName  dán vào đâu ('Word' / 'Excel'), ghi trong câu báo
 * @param toast    hàm báo
 */
async function copyTable(headers: string[], cells: string[], appName: string, toast: ReturnType<typeof useToast>) {
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
    toast(`Đã sao chép bảng mẫu — dán (Ctrl+V) vào file ${appName}`, 'success');
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
 * Một dòng của Bảng mã.
 * @param tag      mã
 * @param meaning  sẽ được điền bằng gì
 * @returns        dòng bảng
 */
function TagRow({ tag, meaning }: { tag: string; meaning: string }) {
  return (
    <tr>
      <td>
        <CodeChip tag={tag} />
      </td>
      <td>{meaning}</td>
    </tr>
  );
}

/** Tên ứng dụng soạn mẫu theo mục đích, ghi trong lời hướng dẫn. */
const APP_NAME: Record<ExportTemplatePurpose, string> = { form: 'Word', stats: 'Excel' };

/**
 * Độ rộng các cột và đầu bảng của Bảng mã. Mọi nhóm mã dùng chung độ rộng cột, nên các cột thẳng hàng giữa các nhóm.
 * @param purpose  mẫu Word hay Excel, để ghi đúng tên ứng dụng
 * @returns        colgroup và thead
 */
function TagTableHead({ purpose }: { purpose: ExportTemplatePurpose }) {
  return (
    <>
      <colgroup>
        <col className={styles.tagColumn} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Gõ vào file {APP_NAME[purpose]}</th>
          <th>Sẽ được điền bằng</th>
        </tr>
      </thead>
    </>
  );
}

/**
 * Các dòng của một câu hỏi trong Bảng mã của mẫu Excel: câu thường một dòng;
 * câu dạng bảng gộp vào một ô (không có mã cột), kèm số dòng và tổng cột.
 * @param question  mã của câu hỏi
 * @returns         các dòng bảng
 */
function StatsQuestionTagRows({ question }: { question: QuestionExportTag }) {
  const kind = question.columns ? undefined : ANSWER_KIND[question.type];
  const rowName = question.rowName || 'dòng';
  return (
    <>
      <tr className={styles.questionGroup}>
        <td colSpan={2}>
          {question.label}
          {question.columns && <span className={styles.kind}> — câu hỏi dạng bảng</span>}
        </td>
      </tr>
      {question.columns ? (
        <>
          <TagRow tag={question.tag} meaning={`Cả bảng trong một ô, mỗi ${rowName} một dòng, vd “1. ${question.columns.map((column) => column.label).join(' · ')}”`} />
          <TagRow tag={`so_${question.tag}`} meaning={`Số ${rowName} trong bảng`} />
          {question.columns
            .filter((column) => column.sum)
            .map((column) => (
              <TagRow key={`tong_${column.tag}`} tag={`tong_${column.tag}`} meaning={`Tổng cột “${column.label}”`} />
            ))}
        </>
      ) : (
        <TagRow tag={question.tag} meaning={`Câu trả lời${kind ? ` (${kind})` : ''}`} />
      )}
    </>
  );
}

/**
 * Các dòng của một câu hỏi trong Bảng mã: câu thường một dòng; câu dạng bảng có bảng mẫu, mã stt, mã cột, số dòng, tổng cột.
 * @param question     mã của câu hỏi
 * @returns  các dòng bảng
 */
function QuestionTagRows({ question }: { question: QuestionExportTag }) {
  const toast = useToast();

  // Câu thường: một dòng mã câu trả lời
  if (!question.columns) {
    const kind = ANSWER_KIND[question.type];
    return (
      <>
        <tr className={styles.questionGroup}>
          <td colSpan={2}>{question.label}</td>
        </tr>
        <TagRow tag={question.tag} meaning={`Câu trả lời${kind ? ` (${kind})` : ''}`} />
      </>
    );
  }

  // Câu dạng bảng: bảng mẫu một dòng có vòng lặp, rồi mã trong và ngoài vòng lặp
  const columns = question.columns;
  const rowName = question.rowName || 'dòng';
  return (
    <>
      <tr className={styles.questionGroup}>
        <td colSpan={2}>
          {question.label} <span className={styles.kind}>— câu hỏi dạng bảng</span>
        </td>
      </tr>
      <tr>
        {/* ô trải hết 2 cột; nội dung bọc trong div, vì đặt display:grid lên td thì nó không còn là ô bảng */}
        <td colSpan={2}>
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
      <TagRow tag={ROW_NUMBER_TAG} meaning="Số thứ tự (đặt trong vòng lặp)" />
      {columns.map((column) => (
        <TagRow key={column.tag} tag={column.tag} meaning={`Cột “${column.label}” (đặt trong vòng lặp)`} />
      ))}
      <TagRow tag={`so_${question.tag}`} meaning={`Số ${rowName} trong bảng (đặt ngoài vòng lặp)`} />
      {columns
        .filter((column) => column.sum)
        .map((column) => (
          <TagRow key={`tong_${column.tag}`} tag={`tong_${column.tag}`} meaning={`Tổng cột “${column.label}” (đặt ngoài vòng lặp)`} />
        ))}
    </>
  );
}

interface ExportTagGuideProps {
  /** Hướng dẫn cho mẫu xuất file đơn (Word) hay thống kê (Excel) */
  purpose: ExportTemplatePurpose;
  /** Mã của các câu hỏi đang soạn */
  questionTags: QuestionExportTag[];
  /** Số phiên bản đang xem */
  version: number;
}

/** Ví dụ của "Cách tạo một mẫu": mỗi dòng một kiểu định dạng của mã (thường, in đậm, in nghiêng, cỡ chữ lớn). Chỉ để minh họa. */
const FORMAT_EXAMPLES = [
  { format: 'Chữ thường', lead: 'Họ và tên: ', tag: 'ho_ten', value: 'Nguyễn Văn A', className: '' },
  { format: 'In đậm', lead: 'MSSV: ', tag: 'mssv', value: '2253801010001', className: styles.demoBold },
  { format: 'In nghiêng', lead: 'Lớp: ', tag: 'lop', value: '47-LTM-A', className: styles.demoItalic },
  { format: 'Cỡ chữ lớn', lead: '', tag: 'loai_don', value: 'Xét miễn môn', className: styles.demoLarge },
];

/** Ví dụ của "Cách tạo một mẫu" ở mẫu Excel: tiêu đề, các cột và vài đơn minh họa (mã đơn nhảy cóc để thấy STT khác mã đơn). */
const STATS_EXAMPLE = {
  title: { template: 'Danh sách đơn {loai_don} · {so_don} đơn', filled: 'Danh sách đơn Xét miễn môn · 3 đơn' },
  columns: [
    { header: 'STT', tag: ROW_NUMBER_TAG },
    { header: 'Mã đơn', tag: 'ma_don' },
    { header: 'Họ và tên', tag: 'ho_ten' },
  ],
  forms: [
    ['1', 'XMM-2026-001-00007', 'Nguyễn Văn A'],
    ['2', 'XMM-2026-001-00012', 'Trần Thị B'],
    ['3', 'XMM-2026-001-00015', 'Lê Văn C'],
  ],
};

/**
 * Một bảng nhỏ trông như trang tính Excel, cho ví dụ của mẫu thống kê: dòng tiêu đề chiếm cả bề ngang, đầu cột, các hàng.
 * @param label  tên ghi nhỏ phía trên, vd "File mẫu cậu soạn"
 * @param title  chữ của dòng tiêu đề
 * @param rows   các hàng (hàng đầu là đầu cột)
 * @returns      khối có tên và bảng
 */
function SheetExample({ label, title, rows }: { label: string; title: string; rows: string[][] }) {
  const [headers = [], ...bodyRows] = rows;
  return (
    <div className={styles.sheetExample}>
      <span className={styles.demoLabel}>{label}</span>
      <div className={styles.wordTableScroll}>
        <table className={styles.wordTable}>
          <tbody>
            <tr>
              <td colSpan={headers.length} className={styles.sheetTitle}>
                {title}
              </td>
            </tr>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
            {bodyRows.map((cells, index) => (
              <tr key={index}>
                {cells.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Tên file mẫu dựng sẵn, theo tên loại đơn; bỏ các kí tự không dùng được trong tên file.
 * @param formTypeName  tên loại đơn đang soạn
 * @param prefix        phần đầu tên file, vd "Mẫu thống kê"
 * @param extension     đuôi file
 * @param version       số phiên bản đang xem
 * @returns             tên file
 */
function starterFileName(formTypeName: string, prefix: string, extension: 'xlsx' | 'docx', version: number): string {
  const safeName = formTypeName.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${prefix}${safeName ? ` - ${safeName}` : ''} - phiên bản ${version}.${extension}`;
}

/**
 * Hai nút của file mẫu có sẵn: "Tải" về máy và "Xem" ngay trong trình duyệt (xem file Word / Excel dựng sẵn, còn nguyên các mã).
 * @param purpose       mẫu Word hay Excel
 * @param sections      các phần của loại đơn đang soạn
 * @param formTypeName  tên loại đơn (đặt tên file)
 * @param version       số phiên bản đang xem (ghi trên nút và tên file)
 * @returns             hai nút và trình xem
 */
function StarterButtons({ purpose, sections, formTypeName, version }: { purpose: ExportTemplatePurpose; sections: readonly FormSection[]; formTypeName: string; version: number }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [previewedFile, setPreviewedFile] = useState<PreviewFile | null>(null);

  /** Dựng file mẫu có sẵn theo bản soạn hiện tại (Word dựng ngay, Excel chờ thư viện bảng tính). */
  const buildStarter = async (): Promise<{ blob: Blob; fileName: string }> => {
    if (purpose === 'form') {
      return { blob: new Blob([createFormStarterDocx(sections)], { type: DOCX_CONTENT_TYPE }), fileName: starterFileName(formTypeName, 'Mẫu đơn', 'docx', version) };
    }
    return { blob: new Blob([await createStatsStarterXlsx(sections)], { type: XLSX_CONTENT_TYPE }), fileName: starterFileName(formTypeName, 'Mẫu thống kê', 'xlsx', version) };
  };

  /** Dựng file rồi tải về máy hoặc mở xem. */
  const run = async (action: 'download' | 'view') => {
    setBusy(true);
    try {
      const { blob, fileName } = await buildStarter();
      if (action === 'download') saveToDevice(blob, fileName);
      else {
        setPreviewedFile({
          id: `starter-${purpose}-${Date.now()}`,
          name: fileName,
          sizeBytes: blob.size,
          content: blob,
          title: fileName,
          note: `File mẫu có sẵn · phiên bản ${version}`,
          downloadLabel: 'Tải file mẫu',
        });
      }
    } catch {
      toast('Không tạo được file mẫu, hãy thử lại.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.starterButtons}>
      <Button className={styles.smallButton} disabled={busy} onClick={() => void run('download')}>
        {busy ? 'Đang tạo…' : `Tải file mẫu có sẵn (phiên bản ${version})`}
      </Button>
      <Button className={styles.smallButton} disabled={busy} onClick={() => void run('view')}>
        Xem file mẫu
      </Button>
      <FilePreview file={previewedFile} onClose={() => setPreviewedFile(null)} />
    </div>
  );
}

/**
 * Nội dung "Cách tạo một mẫu" của mẫu Excel (luôn hiện): nút tải file mẫu có sẵn, 3 dòng hướng dẫn, ví dụ file mẫu → file xuất ra.
 * @param sections      các phần của loại đơn đang soạn (để dựng file mẫu có sẵn)
 * @param formTypeName  tên loại đơn (đặt tên file)
 * @param version       số phiên bản đang xem (ghi trên nút và tên file)
 * @returns             nội dung mục
 */
function StatsHowTo({ sections, formTypeName, version }: { sections: readonly FormSection[]; formTypeName: string; version: number }) {
  const headers = STATS_EXAMPLE.columns.map((column) => column.header);

  return (
    <div className={styles.guideBody}>
      <ol className={styles.steps}>
        <li>
          <b>Soạn file Excel</b>
          <span>Bấm “Tải file mẫu có sẵn” bên dưới, mở bằng Excel. Xóa cột không cần, đổi màu, cỡ chữ tùy ý.</span>
        </li>
        <li>
          <b>Tải lên</b>
          <span>Kéo thả file vào mục trên rồi bấm Lưu. Mã gõ sai sẽ có cảnh báo ngay dưới mẫu.</span>
        </li>
        <li>
          <b>Xuất file</b>
          <span>Bấm “Xuất thống kê” ở đầu trang để nhận file Excel có mọi đơn của loại đơn này.</span>
        </li>
      </ol>

      {/* Ví dụ: tiêu đề điền một lần; hàng mẫu nhân lên mỗi đơn một hàng */}
      <div className={styles.sheetExamples} aria-label="Ví dụ">
        <SheetExample label="File mẫu" title={STATS_EXAMPLE.title.template} rows={[headers, STATS_EXAMPLE.columns.map((column) => `{${column.tag}}`)]} />
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
        <SheetExample label="File xuất ra" title={STATS_EXAMPLE.title.filled} rows={[headers, ...STATS_EXAMPLE.forms]} />
      </div>
      <p className={styles.hint}>
        Hàng có mã của đơn là <b>hàng mẫu</b>: nhân lên mỗi đơn một hàng. Tiêu đề chỉ có mã của cả file nên điền một lần. {'{stt}'} là số đếm
        1, 2, 3… của hàng, không phải mã đơn.
      </p>
      {/* File mẫu dựng sẵn: đầu cột và mã mọi câu hỏi của loại đơn đang soạn */}
      <StarterButtons purpose="stats" sections={sections} formTypeName={formTypeName} version={version} />
    </div>
  );
}

/**
 * Nội dung "Cách tạo một mẫu" của mẫu Word: 3 bước, ví dụ trước / sau theo kiểu định dạng.
 * @returns  nội dung mục
 */
function FormHowTo({ sections, formTypeName, version }: { sections: readonly FormSection[]; formTypeName: string; version: number }) {
  return (
    <div className={styles.guideBody}>
      <ol className={styles.steps}>
        <li>
          <b>Soạn file Word</b>
          <span>Bấm “Tải file mẫu có sẵn” bên dưới rồi sửa tùy ý, hoặc tự gõ mã vào chỗ cần điền (lấy mã ở Bảng mã).</span>
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
        {FORMAT_EXAMPLES.map((example) => (
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
      {/* File mẫu dựng sẵn: thông tin người nộp, mã mọi câu hỏi của loại đơn đang soạn */}
      <StarterButtons purpose="form" sections={sections} formTypeName={formTypeName} version={version} />
    </div>
  );
}

/**
 * Một nhóm mã thu gọn được của Bảng mã.
 * @param title     tên nhóm
 * @param purpose   mẫu Word hay Excel (đầu bảng)
 * @param children  các dòng bảng
 * @returns         mục thu gọn có bảng mã
 */
function TagGroup({ title, purpose, children }: { title: string; purpose: ExportTemplatePurpose; children: ReactNode }) {
  return (
    <details className={styles.tagGroup}>
      <summary>{title}</summary>
      <div className={styles.tagTableScroll}>
        <table className={styles.tagTable}>
          <TagTableHead purpose={purpose} />
          <tbody>{children}</tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Mục "Cách tạo một mẫu" (thu gọn được, mặc định đóng); đặt ngay trên khung chọn file.
 * @param purpose       mẫu xuất file đơn hay thống kê
 * @param sections      các phần của loại đơn đang soạn (mẫu Excel dựng file mẫu có sẵn)
 * @param formTypeName  tên loại đơn đang soạn (tên file mẫu có sẵn)
 * @returns             mục thu gọn
 */
export function ExportHowTo({ purpose, sections, formTypeName, version }: { purpose: ExportTemplatePurpose; sections: readonly FormSection[]; formTypeName: string; version: number }) {
  return (
    <details className={styles.guide}>
      <summary>Cách tạo một mẫu</summary>
      {purpose === 'form' ? <FormHowTo sections={sections} formTypeName={formTypeName} version={version} /> : <StatsHowTo sections={sections} formTypeName={formTypeName} version={version} />}
    </details>
  );
}

/**
 * Các nhóm mã của Bảng mã.
 * Mẫu Excel có thêm nhóm "Tiêu đề file" (mã chỉ điền một lần) và {stt} (số đếm của hàng) ở nhóm Thông tin đơn; câu hỏi dạng bảng gộp vào một ô.
 * @param props  xem ExportTagGuideProps
 * @returns      các nhóm mã thu gọn được
 */
function TagGroups({ purpose, questionTags }: Omit<ExportTagGuideProps, 'version'>) {
  return (
    <div className={styles.tagGroups}>
      {/* Mẫu Excel: mã chỉ điền một lần cho cả file */}
      {purpose === 'stats' && (
        <TagGroup title="Tiêu đề file (điền một lần, không lặp theo đơn)" purpose={purpose}>
          {STATS_SUMMARY_TAGS.map(({ tag, label }) => (
            <TagRow key={tag} tag={tag} meaning={label} />
          ))}
        </TagGroup>
      )}
      {questionTags.length ? (
        <TagGroup title="Câu trả lời trong đơn" purpose={purpose}>
          {/* khóa theo vị trí: lúc đang soạn hai câu có thể trùng mã (báo lỗi khi Lưu) */}
          {questionTags.map((question, index) =>
            purpose === 'form' ? <QuestionTagRows key={index} question={question} /> : <StatsQuestionTagRows key={index} question={question} />,
          )}
        </TagGroup>
      ) : (
        <details className={styles.tagGroup}>
          <summary>Câu trả lời trong đơn</summary>
          <p className={styles.hint}>Loại đơn chưa có câu hỏi.</p>
        </details>
      )}
      {COMMON_EXPORT_TAG_GROUPS.map((group) => (
        <TagGroup key={group.title} title={group.title} purpose={purpose}>
          {/* Mẫu Excel: {stt} đứng đầu nhóm có mã đơn */}
          {purpose === 'stats' && group.tags.some(({ tag }) => tag === 'ma_don') && (
            <TagRow tag={ROW_NUMBER_TAG} meaning="Số thứ tự hàng (1, 2, 3…), không phải mã đơn" />
          )}
          {group.tags.map(({ tag, label }) => (
            <TagRow key={tag} tag={tag} meaning={label} />
          ))}
        </TagGroup>
      ))}
    </div>
  );
}

/**
 * Mục "Bảng mã" (các nhóm mã thu gọn được, mặc định đóng).
 * @param props  xem ExportTagGuideProps
 * @returns      mục Bảng mã
 */
export function ExportTagGuide({ purpose, questionTags, version }: ExportTagGuideProps) {
  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <h3>Bảng mã</h3>
        <span className={styles.versionChip}>Phiên bản {version}</span>
      </div>
      <p className={styles.hint}>Bấm vào mã để sao chép, rồi dán vào file {APP_NAME[purpose]}.</p>
      <TagGroups purpose={purpose} questionTags={questionTags} />
    </div>
  );
}
