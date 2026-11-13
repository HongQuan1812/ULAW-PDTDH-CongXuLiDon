/* MÃ TRƯỜNG của mẫu xuất file Word.
   Cán bộ gõ mã trong ngoặc nhọn vào file Word, vd {ho_ten}, {mssv}; khi xuất file, máy chủ thay mã bằng dữ liệu của đơn.
   - Mã chung (mọi loại đơn): thông tin người nộp đơn và thông tin đơn (COMMON_EXPORT_TAG_GROUPS).
   - Mã câu hỏi: ô "Mã dùng trong file Word" của câu hỏi; bỏ trống thì lấy theo nội dung câu hỏi bỏ dấu.
   - Câu hỏi dạng bảng: vòng lặp {#mã bảng} … {/mã bảng}; trong vòng lặp có {stt} và mã từng cột (theo tên cột);
     ngoài vòng lặp có {so_<mã bảng>} (số dòng) và {tong_<mã cột>} (tổng cột có tính tổng).
   Trình soạn (bảng mã, kiểm tra trùng mã), API giả và backend (điền mẫu, kiểm tra mẫu) cùng dùng file này. */
import type { AnswerValue, FormAnswers, TableCell } from '../aux-schema/forms--answers';
import type { AnswerableQuestion, Question, TableColumn } from '../aux-schema/form-types--question-types';
import { richTextToPlainText, type RichTextDoc } from '../aux-schema/rich-text';
import type { FormSection } from '../aux-schema/form-types--sections';
import { FORM_STATUS_LABEL, type FormStatus } from '../aux-schema/forms--statuses';

/* ---------- Đặt mã ---------- */

/** Mã hợp lệ: chữ thường không dấu, số, gạch dưới; không bắt đầu bằng số. */
export const EXPORT_TAG_PATTERN = /^[a-z_][a-z0-9_]*$/;

/** Mã của số thứ tự dòng trong vòng lặp bảng. */
export const ROW_NUMBER_TAG = 'stt';

/**
 * Đổi một đoạn chữ thành mã: bỏ dấu, chữ thường, ký tự khác chữ số thành "_", vd "Tệp bảng điểm" → "tep_bang_diem".
 * @param text  nội dung câu hỏi hoặc tên cột
 * @returns     mã; bắt đầu bằng số thì thêm "_" phía trước; không còn chữ nào thì "truong"
 */
export function textToTag(text: string): string {
  const tag = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1');
  return tag || 'truong';
}

/**
 * Mã của một câu hỏi trong file Word.
 * @param question  câu hỏi (có thể có mã riêng)
 * @returns         mã riêng, hoặc mã lấy theo nội dung câu hỏi
 */
export function questionTag(question: Pick<AnswerableQuestion, 'label'> & { tag?: string }): string {
  return question.tag || textToTag(question.label);
}

/**
 * Mã của một cột bảng trong file Word.
 * @param column  cột (có thể có mã riêng)
 * @returns       mã riêng, hoặc mã lấy theo tên cột
 */
export function columnTag(column: Pick<TableColumn, 'label' | 'tag'>): string {
  return column.tag || textToTag(column.label);
}

/* ---------- Mã chung ---------- */

/** Một mã kèm lời giải thích, hiện trong Bảng mã của trình soạn. */
export interface ExportTagInfo {
  tag: string;
  label: string;
}

/** Mã có sẵn cho mọi loại đơn, theo nhóm. */
export const COMMON_EXPORT_TAG_GROUPS: ReadonlyArray<{ title: string; tags: readonly ExportTagInfo[] }> = [
  {
    title: 'Người nộp đơn',
    tags: [
      { tag: 'ho_ten', label: 'Họ và tên' },
      { tag: 'mssv', label: 'MSSV' },
      { tag: 'lop', label: 'Lớp' },
      { tag: 'khoa_hoc', label: 'Khóa học hiện tại' },
      { tag: 'khoa_hoc_goc', label: 'Khóa học gốc' },
      { tag: 'hinh_thuc', label: 'Hình thức đào tạo' },
      { tag: 'nganh', label: 'Ngành' },
      { tag: 'email', label: 'Email' },
      { tag: 'sdt', label: 'Số điện thoại' },
      { tag: 'cccd', label: 'Số CCCD' },
    ],
  },
  {
    title: 'Thông tin đơn',
    tags: [
      { tag: 'ma_don', label: 'Mã đơn' },
      { tag: 'loai_don', label: 'Tên loại đơn' },
      { tag: 'ngay_nop', label: 'Ngày nộp (dd/mm/yyyy)' },
      { tag: 'gio_nop', label: 'Giờ nộp' },
      { tag: 'ngay', label: 'Ngày nộp — số ngày' },
      { tag: 'thang', label: 'Ngày nộp — tháng' },
      { tag: 'nam', label: 'Ngày nộp — năm' },
      { tag: 'trang_thai', label: 'Trạng thái' },
      { tag: 'nguoi_tiep_nhan', label: 'Người tiếp nhận' },
      { tag: 'nguoi_xu_li', label: 'Người xử lí' },
      { tag: 'ngay_xu_li', label: 'Ngày Duyệt / Từ chối' },
      { tag: 'ly_do', label: 'Lí do của phòng Đào tạo' },
      { tag: 'ngay_xuat', label: 'Ngày xuất file' },
    ],
  },
];

/** Mã cũ vẫn điền được (cho mẫu đã soạn trước), không hiện trong Bảng mã: mã cũ → mã mới cùng giá trị. */
export const LEGACY_EXPORT_TAGS: Readonly<Record<string, string>> = { tinh_trang: 'trang_thai' };

/** Mọi mã chung (kể cả mã cũ), để báo trùng khi cán bộ đặt mã câu hỏi. */
export const COMMON_EXPORT_TAGS: ReadonlySet<string> = new Set([
  ...COMMON_EXPORT_TAG_GROUPS.flatMap((group) => group.tags.map(({ tag }) => tag)),
  ...Object.keys(LEGACY_EXPORT_TAGS),
]);

/* ---------- Mã riêng của mẫu xuất file thống kê (Excel) ---------- */

/** Mã số lá đơn có trong file thống kê. */
export const FORM_COUNT_TAG = 'so_don';

/** Mã chung của cả file thống kê: đặt ở hàng không có mã của đơn (vd tiêu đề, dòng tổng) thì chỉ điền một lần. */
export const STATS_SUMMARY_TAGS: readonly ExportTagInfo[] = [
  { tag: FORM_COUNT_TAG, label: 'Số đơn trong file' },
  { tag: 'loai_don', label: 'Tên loại đơn' },
  { tag: 'ngay_xuat', label: 'Ngày xuất file' },
];

/* ---------- Mã theo câu hỏi của loại đơn ---------- */

/** Mã của một câu hỏi cần trả lời; câu hỏi dạng bảng có thêm mã các cột. */
export interface QuestionExportTag {
  tag: string;
  /** Nội dung câu hỏi */
  label: string;
  type: Exclude<Question['type'], 'info'>;
  /** Câu hỏi dạng bảng: tên một dòng, vd "môn" */
  rowName?: string;
  /** Câu hỏi dạng bảng: mã các cột, theo thứ tự cột */
  columns?: Array<{ tag: string; label: string; sum: boolean }>;
}

/**
 * Mã của mọi câu hỏi cần trả lời trong loại đơn, theo thứ tự trên đơn (bỏ khối thông báo).
 * @param sections  các phần của loại đơn
 * @returns         mã từng câu hỏi
 */
export function questionExportTags(sections: readonly FormSection[]): QuestionExportTag[] {
  return sections.flatMap((section) =>
    section.questions.flatMap((question): QuestionExportTag[] => {
      if (question.type === 'info') return [];
      const base = { tag: questionTag(question), label: question.label || '(chưa có tên)', type: question.type };
      if (question.type !== 'table') return [base];
      return [
        {
          ...base,
          rowName: question.rowName,
          columns: question.columns.map((column) => ({ tag: columnTag(column), label: column.label, sum: Boolean(column.sum) })),
        },
      ];
    }),
  );
}

/**
 * Mọi mã dùng được trong mẫu của một loại đơn (để Kiểm tra mẫu).
 * @param sections  các phần của loại đơn
 * @returns         mã chung, mã câu hỏi, và với câu hỏi dạng bảng: stt, mã cột, so_<bảng>, tong_<cột>
 */
export function knownExportTags(sections: readonly FormSection[]): Set<string> {
  const known = new Set(COMMON_EXPORT_TAGS);
  for (const question of questionExportTags(sections)) {
    known.add(question.tag);
    if (!question.columns) continue;
    known.add(ROW_NUMBER_TAG);
    known.add(`so_${question.tag}`);
    for (const column of question.columns) {
      known.add(column.tag);
      if (column.sum) known.add(`tong_${column.tag}`);
    }
  }
  return known;
}

/**
 * Mã cột của từng bảng, để Kiểm tra mẫu báo mã cột đặt ngoài vòng lặp.
 * @param sections  các phần của loại đơn
 * @returns         mã cột (và stt) → các mã bảng chứa cột đó
 */
export function columnTagOwners(sections: readonly FormSection[]): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  const addOwner = (columnTagText: string, tableTag: string) => owners.set(columnTagText, [...(owners.get(columnTagText) ?? []), tableTag]);
  for (const question of questionExportTags(sections)) {
    if (!question.columns) continue;
    addOwner(ROW_NUMBER_TAG, question.tag);
    question.columns.forEach((column) => addOwner(column.tag, question.tag));
  }
  return owners;
}

/* ---------- Dữ liệu điền vào mẫu ---------- */

/** Giá trị điền vào mẫu: chữ, số, hoặc các dòng của bảng (mỗi dòng theo mã cột). */
export type ExportValue = string | number | Array<Record<string, string | number>>;
export type ExportData = Record<string, ExportValue>;

/** Thông tin của một lá đơn cần để điền mẫu. Máy chủ lấy từ CSDL; CCCD là số đầy đủ. */
export interface ExportSource {
  code: string;
  formTypeName: string;
  /** Lúc nộp, 'YYYY-MM-DDTHH:mm' */
  submittedAt: string;
  status: FormStatus;
  receiverName: string | null;
  handlerName: string | null;
  /** Lúc Duyệt / Từ chối gần nhất, 'YYYY-MM-DDTHH:mm'; null = chưa */
  decidedAt: string | null;
  /** Lí do của phòng Đào tạo; "" = không có */
  note: string;
  applicant: { name: string; email: string; phone: string | null; cccd: string | null };
  /** MSSV chính của người nộp đơn; null = không có MSSV */
  mainStudent: {
    studentId: string;
    className: string | null;
    trainingMode: string | null;
    major: string | null;
    currentCohort: string | null;
    originalCohort: string | null;
  } | null;
  /** Các phần của loại đơn lúc nộp (bản chụp) */
  sections: readonly FormSection[];
  answers: FormAnswers;
}

/**
 * Ngày dạng dd/mm/yyyy.
 * @param isoDateTime  'YYYY-MM-DD', có thể kèm giờ
 * @returns            vd '30/10/2026'; trống thì ""
 */
function toDayMonthYear(isoDateTime: string | null): string {
  return isoDateTime ? isoDateTime.slice(0, 10).split('-').reverse().join('/') : '';
}

/**
 * Số điện thoại tách nhóm, vd '0901234567' → '0901 234 567'.
 * @param phone  số điện thoại; null = chưa có
 * @returns      số đã tách nhóm, hoặc ""
 */
function spacedPhone(phone: string | null): string {
  return phone ? phone.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3') : '';
}

/** Câu trả lời là văn bản có định dạng (câu hỏi đoạn văn) hay không. */
const isRichTextAnswer = (value: AnswerValue): value is RichTextDoc => typeof value === 'object' && !Array.isArray(value);

/**
 * Câu trả lời của một câu hỏi (không phải bảng) dưới dạng chữ để điền:
 * đoạn văn → chữ thường (đoạn nối bằng xuống dòng); chọn nhiều → nối bằng dấu phẩy; tệp → tên các tệp; ngày → dd/mm/yyyy; chưa trả lời → "".
 * @param question  câu hỏi
 * @param value     câu trả lời
 * @returns         chữ hoặc số để điền
 */
function answerText(question: Question, value: AnswerValue | undefined): string | number {
  if (value === undefined || value === null) return '';
  if (isRichTextAnswer(value)) return richTextToPlainText(value);
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'object' && item !== null && 'name' in item ? item.name : String(item))).join(', ');
  }
  if (question.type === 'date' && typeof value === 'string') return toDayMonthYear(value);
  return value;
}

/**
 * Thêm giá trị cho các mã cũ, bằng giá trị của mã mới tương ứng.
 * @param exportData  dữ liệu đã có mã chung (sửa trực tiếp)
 */
function addLegacyTags(exportData: ExportData): void {
  for (const [legacyTag, currentTag] of Object.entries(LEGACY_EXPORT_TAGS)) exportData[legacyTag] = exportData[currentTag]!;
}

/**
 * Dựng dữ liệu điền vào mẫu từ một lá đơn.
 * @param source      thông tin lá đơn
 * @param exportedOn  ngày xuất file, 'YYYY-MM-DD'
 * @returns           giá trị theo mã
 */
export function buildExportData(source: ExportSource, exportedOn: string): ExportData {
  const { submittedAt, mainStudent, applicant } = source;

  // Mã chung: người nộp đơn (MSSV chính) và thông tin đơn
  const exportData: ExportData = {
    ho_ten: applicant.name,
    mssv: mainStudent?.studentId ?? '',
    lop: mainStudent?.className ?? '',
    khoa_hoc: mainStudent?.currentCohort ?? '',
    khoa_hoc_goc: mainStudent?.originalCohort ?? '',
    hinh_thuc: mainStudent?.trainingMode ?? '',
    nganh: mainStudent?.major ?? '',
    email: applicant.email,
    sdt: spacedPhone(applicant.phone),
    cccd: applicant.cccd ?? '',
    ma_don: source.code,
    loai_don: source.formTypeName,
    ngay_nop: toDayMonthYear(submittedAt),
    gio_nop: submittedAt.slice(11, 16),
    ngay: submittedAt.slice(8, 10),
    thang: submittedAt.slice(5, 7),
    nam: submittedAt.slice(0, 4),
    trang_thai: FORM_STATUS_LABEL[source.status],
    nguoi_tiep_nhan: source.receiverName ?? '',
    nguoi_xu_li: source.handlerName ?? '',
    ngay_xu_li: toDayMonthYear(source.decidedAt),
    ly_do: source.note,
    ngay_xuat: toDayMonthYear(exportedOn),
  };
  addLegacyTags(exportData);

  // Mã câu hỏi: bảng thành các dòng (kèm số dòng, tổng cột), câu khác thành chữ
  for (const section of source.sections) {
    for (const question of section.questions) {
      if (question.type === 'info') continue;
      const tag = questionTag(question);
      const value = source.answers[question.id];
      if (question.type !== 'table') {
        exportData[tag] = answerText(question, value);
        continue;
      }
      const rows = (Array.isArray(value) ? value : []) as TableCell[][];
      exportData[tag] = rows.map((row, rowIndex) =>
        Object.fromEntries([[ROW_NUMBER_TAG, rowIndex + 1], ...question.columns.map((column, i) => [columnTag(column), row[i] ?? ''])]),
      );
      exportData[`so_${tag}`] = rows.length;
      question.columns.forEach((column, i) => {
        if (column.sum) exportData[`tong_${columnTag(column)}`] = rows.reduce((total, row) => total + (Number(row[i]) || 0), 0);
      });
    }
  }
  return exportData;
}
