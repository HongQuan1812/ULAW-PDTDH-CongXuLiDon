/* Kiểm tra câu trả lời của lá đơn theo cấu trúc loại đơn (như check() của từng loại câu hỏi trong artifact/js/sections.js).
   Trang nộp đơn, API giả và backend cùng dùng validateAnswers(), nên câu báo lỗi giống nhau ở mọi nơi. */
import type { AnswerableQuestion, QuestionOf, TableColumn } from '../aux-schema/form-types--question-types';
import type { FormSection } from '../aux-schema/form-types--sections';
import { RichTextDocSchema, isRichTextEmpty, type RichTextDoc } from '../aux-schema/rich-text';
import { isAnswerable, type AnswerValue, type FileRef, type FormAnswers, type TableCell } from '../aux-schema/forms--answers';

/** Câu báo lỗi khi kiểm tra câu trả lời (hiện ngay dưới câu hỏi, hoặc dưới nút Gửi đơn). */
export const ANSWER_MESSAGES = {
  required: 'Câu hỏi này bắt buộc.',
  pickOne: 'Chọn một mục.',
  pickAtLeastOne: 'Chọn ít nhất một mục.',
  invalidChoice: 'Lựa chọn không hợp lệ.',
  notNumber: 'Nhập một số.',
  invalidDate: 'Ngày không hợp lệ.',
  fileRequired: 'Tải lên ít nhất một tệp.',
  /** Nộp / sửa đơn: câu trả lời có tệp mà máy chủ không nhận được nội dung, vd "bang-diem.pdf: không nhận được tệp. Gỡ tệp này rồi chọn lại." */
  fileMissing: (fileName: string) => `${fileName}: không nhận được tệp. Gỡ tệp này rồi chọn lại.`,
  /** Nộp / sửa đơn: có tệp gửi kèm không thuộc câu hỏi nào */
  unexpectedFiles: 'Có tệp gửi kèm không thuộc câu hỏi nào.',
  /** Tệp sai định dạng, vd "a.exe: định dạng không hỗ trợ, hãy dùng PDF · JPG · PNG." */
  fileType: (fileName: string, acceptedText: string) => `${fileName}: định dạng không hỗ trợ, hãy dùng ${acceptedText}.`,
  /** Tệp quá lớn, vd "a.pdf: 12.4 MB, vượt quá 10 MB." */
  fileTooLarge: (fileName: string, sizeText: string, maxMB: number) => `${fileName}: ${sizeText}, vượt quá ${maxMB} MB.`,
  /** Bảng bắt buộc mà chưa có dòng nào, vd "Thêm ít nhất một môn." */
  tableRowRequired: (rowName: string) => `Thêm ít nhất một ${rowName}.`,
  /** Bảng có ô còn trống */
  tableCellsMissing: (columnCount: number) => `Điền đủ ${columnCount} cột cho các ô được tô đỏ.`,
  /** Cột số có ô không phải số không âm */
  tableNumberInvalid: (columnLabel: string) => `Cột “${columnLabel}” chỉ nhận số không âm.`,
  /** Cột chọn có ô không thuộc danh sách lựa chọn */
  tableChoiceInvalid: (columnLabel: string) => `Cột “${columnLabel}”: chọn một giá trị trong danh sách.`,
  /** Câu báo chung dưới nút Gửi đơn cho phần có lỗi */
  section: (sectionTitle: string) => `Kiểm tra lại phần “${sectionTitle}”.`,
  /** Một câu gộp các phần có lỗi (toast khi bấm Gửi đơn), vd "Kiểm tra lại các phần “A”, “B”." */
  sectionsToCheck: (sectionTitles: readonly string[]) =>
    sectionTitles.length === 1
      ? `Kiểm tra lại phần “${sectionTitles[0]}”.`
      : `Kiểm tra lại các phần ${sectionTitles.map((title) => `“${title}”`).join(', ')}.`,
  /** Chưa đánh dấu ô cam đoan ở cuối lá đơn */
  commitmentRequired: 'Đánh dấu ô cam đoan trước khi gửi.',
} as const;

/**
 * Ô của bảng còn trống chưa.
 * @param cell  giá trị ô
 * @returns     true nếu null hoặc chuỗi chỉ có khoảng trắng
 */
export function isEmptyCell(cell: TableCell | undefined): boolean {
  return cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '');
}

/**
 * Ô đã điền của bảng có đúng kiểu cột không (ô trống thì kiểm tra riêng bằng isEmptyCell).
 * @param column  cột chứa ô
 * @param cell    giá trị ô
 * @returns       cột số: số không âm · cột chọn: một giá trị trong danh sách lựa chọn · cột chữ: luôn đúng
 */
export function isValidTableCell(column: Pick<TableColumn, 'type' | 'options'>, cell: TableCell | undefined): boolean {
  if (column.type === 'number') return typeof cell === 'number' && Number.isFinite(cell) && cell >= 0;
  if (column.type === 'select') return typeof cell === 'string' && (column.options ?? []).includes(cell);
  return true;
}

/* ---------- Tệp tải lên ---------- */

/**
 * Các đuôi tệp câu hỏi nhận (nhận jpg thì nhận cả jpeg).
 * @param question  câu hỏi tải tệp
 * @returns         đuôi tệp chữ thường, vd ['pdf', 'jpg', 'png', 'jpeg']
 */
export function acceptedExtensions(question: QuestionOf<'file'>): string[] {
  const extensions = question.accept.map((extension) => extension.toLowerCase());
  if (extensions.includes('jpg') && !extensions.includes('jpeg')) extensions.push('jpeg');
  return extensions;
}

/**
 * Các định dạng nhận, để ghi cho người nộp đơn đọc.
 * @param question  câu hỏi tải tệp
 * @returns         vd 'PDF · JPG · PNG'
 */
export function acceptedExtensionsText(question: QuestionOf<'file'>): string {
  return question.accept.map((extension) => extension.toUpperCase()).join(' · ');
}

/**
 * Dung lượng tệp để ghi cho người đọc.
 * @param sizeBytes  dung lượng (byte)
 * @returns          vd '820 KB', '12.4 MB'
 */
export function formatFileSize(sizeBytes: number): string {
  const megabyte = 1024 * 1024;
  return sizeBytes < megabyte ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB` : `${(sizeBytes / megabyte).toFixed(1)} MB`;
}

/**
 * Kiểm tra một tệp trước khi tải lên: đúng định dạng và không quá dung lượng.
 * @param question   câu hỏi tải tệp
 * @param fileName   tên tệp, vd 'bang-diem.pdf'
 * @param sizeBytes  dung lượng (byte)
 * @returns          "" nếu nhận được, ngược lại là câu báo lỗi có tên tệp
 */
export function validateFile(question: QuestionOf<'file'>, fileName: string, sizeBytes: number): string {
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  if (!acceptedExtensions(question).includes(extension)) {
    return ANSWER_MESSAGES.fileType(fileName, acceptedExtensionsText(question));
  }
  if (sizeBytes > question.maxMB * 1024 * 1024) {
    return ANSWER_MESSAGES.fileTooLarge(fileName, formatFileSize(sizeBytes), question.maxMB);
  }
  return '';
}

/** Thông tin một tệp gửi kèm khi nộp hoặc sửa đơn, đủ để kiểm tra. */
export interface SentFileInfo {
  name: string;
  sizeBytes: number;
}

/**
 * Kiểm tra các tệp khi nộp hoặc sửa đơn (máy chủ dùng): mỗi tệp trong câu trả lời phải là tệp đã lưu của chính đơn đó (khi sửa),
 * hoặc có nội dung gửi kèm, đúng định dạng và dung lượng của câu hỏi; không tệp nào lặp lại, không có tệp gửi kèm nào thừa.
 * @param sections       các phần của loại đơn
 * @param answers        câu trả lời theo id câu hỏi; tệp mới mang id tạm, tệp giữ lại mang id ở máy chủ
 * @param sentFiles      tệp gửi kèm theo id tạm (tên, dung lượng lấy từ tệp thật)
 * @param savedFileIds   id các tệp đơn đang có ở máy chủ (sửa đơn); nộp đơn mới thì không có
 * @returns              "" nếu mọi tệp đều được, ngược lại là câu báo lỗi đầu tiên
 */
export function validateSentFiles(
  sections: readonly FormSection[],
  answers: FormAnswers,
  sentFiles: ReadonlyMap<string, SentFileInfo>,
  savedFileIds: ReadonlySet<string> = new Set(),
): string {
  const referencedIds = new Set<string>();
  for (const question of sections.flatMap((section) => section.questions)) {
    const answer = answers[question.id];
    if (question.type !== 'file' || !isFileList(answer)) continue;
    for (const file of answer) {
      // Tệp đã lưu của đơn: giữ nguyên, đã kiểm tra lúc tải lên
      if (referencedIds.has(file.id)) return ANSWER_MESSAGES.fileMissing(file.name);
      if (savedFileIds.has(file.id) && !sentFiles.has(file.id)) {
        referencedIds.add(file.id);
        continue;
      }

      // Tệp mới phải có nội dung gửi kèm, đúng định dạng, không quá dung lượng
      const sentFile = sentFiles.get(file.id);
      if (!sentFile) return ANSWER_MESSAGES.fileMissing(file.name);
      const message = validateFile(question, sentFile.name, sentFile.sizeBytes);
      if (message) return message;
      referencedIds.add(file.id);
    }
  }

  // Tệp gửi kèm mà không thuộc câu trả lời nào
  return [...sentFiles.keys()].every((id) => referencedIds.has(id)) ? '' : ANSWER_MESSAGES.unexpectedFiles;
}

/* ---------- Câu trả lời ---------- */

/** Chuỗi hay không. */
const isText = (value: unknown): value is string => typeof value === 'string';
/** Mảng chuỗi hay không. */
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);
/** Văn bản có định dạng hay không (đúng hình dạng; nội dung lạ đã bị schema của API từ chối). */
const isRichTextDoc = (value: unknown): value is RichTextDoc => RichTextDocSchema.safeParse(value).success;
/** Danh sách tệp đã tải lên hay không. */
const isFileList = (value: unknown): value is FileRef[] =>
  Array.isArray(value) && value.every((file) => typeof file === 'object' && file !== null && 'id' in file);

/**
 * Kiểm tra câu trả lời của một câu hỏi.
 * @param question  câu hỏi
 * @param value     câu trả lời; undefined = chưa có
 * @returns         "" nếu hợp lệ, ngược lại là câu báo lỗi hiện ngay dưới câu hỏi
 */
export function validateAnswer(question: AnswerableQuestion, value: AnswerValue | undefined): string {
  switch (question.type) {
    case 'text': {
      const text = isText(value) ? value.trim() : '';
      return question.required && !text ? ANSWER_MESSAGES.required : '';
    }
    case 'para': {
      // Đoạn văn là văn bản có định dạng; đơn cũ còn lưu dạng chuỗi
      const isEmpty = isText(value) ? !value.trim() : !isRichTextDoc(value) || isRichTextEmpty(value);
      return question.required && isEmpty ? ANSWER_MESSAGES.required : '';
    }
    case 'number': {
      if (value === null || value === undefined || value === '') return question.required ? ANSWER_MESSAGES.required : '';
      return typeof value === 'number' && Number.isFinite(value) ? '' : ANSWER_MESSAGES.notNumber;
    }
    case 'date': {
      const text = isText(value) ? value : '';
      if (!text) return question.required ? ANSWER_MESSAGES.required : '';
      return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text)) ? '' : ANSWER_MESSAGES.invalidDate;
    }
    case 'radio':
    case 'select': {
      const choice = isText(value) ? value : '';
      if (!choice) return question.required ? ANSWER_MESSAGES.pickOne : '';
      return question.options.includes(choice) ? '' : ANSWER_MESSAGES.invalidChoice;
    }
    case 'check': {
      const choices = isTextList(value) ? value : [];
      if (!choices.length) return question.required ? ANSWER_MESSAGES.pickAtLeastOne : '';
      return choices.every((choice) => question.options.includes(choice)) ? '' : ANSWER_MESSAGES.invalidChoice;
    }
    case 'file': {
      const files = isFileList(value) ? value : [];
      return question.required && !files.length ? ANSWER_MESSAGES.fileRequired : '';
    }
    case 'table': {
      const rows = Array.isArray(value) ? (value as unknown[]) : [];
      if (!rows.length) return question.required ? ANSWER_MESSAGES.tableRowRequired(question.rowName) : '';

      // Mỗi dòng đủ ô, không ô nào trống
      const columns = question.columns;
      const allFilled = rows.every(
        (row) => Array.isArray(row) && columns.every((_, index) => !isEmptyCell(row[index] as TableCell)),
      );
      if (!allFilled) return ANSWER_MESSAGES.tableCellsMissing(columns.length);

      // Cột số chỉ nhận số không âm; cột chọn chỉ nhận giá trị có trong danh sách
      for (const [index, column] of columns.entries()) {
        if (column.type === 'text') continue;
        const valid = rows.every((row) => isValidTableCell(column, (row as TableCell[])[index]));
        if (valid) continue;
        return column.type === 'number' ? ANSWER_MESSAGES.tableNumberInvalid(column.label) : ANSWER_MESSAGES.tableChoiceInvalid(column.label);
      }
      return '';
    }
  }
}

/** Kết quả kiểm tra cả lá đơn. */
export interface AnswersValidation {
  /** Lỗi theo id câu hỏi (chỉ câu có lỗi) */
  questionErrors: Record<string, string>;
  /** Câu báo chung cho từng phần có lỗi, theo thứ tự phần */
  sectionErrors: string[];
  /** Tiêu đề các phần có lỗi, theo thứ tự phần (ghép thành câu bằng ANSWER_MESSAGES.sectionsToCheck) */
  invalidSectionTitles: string[];
}

/**
 * Kiểm tra mọi câu trả lời của lá đơn theo cấu trúc loại đơn.
 * @param sections  các phần của loại đơn
 * @param answers   câu trả lời theo id câu hỏi
 * @returns         lỗi từng câu, câu báo chung và tiêu đề từng phần có lỗi; không có lỗi thì đều trống
 */
export function validateAnswers(sections: readonly FormSection[], answers: FormAnswers): AnswersValidation {
  const questionErrors: Record<string, string> = {};
  const sectionErrors: string[] = [];
  const invalidSectionTitles: string[] = [];

  sections.forEach((section) => {
    let sectionHasError = false;
    section.questions.filter(isAnswerable).forEach((question) => {
      const message = validateAnswer(question, answers[question.id]);
      if (!message) return;
      questionErrors[question.id] = message;
      sectionHasError = true;
    });
    if (!sectionHasError) return;
    sectionErrors.push(ANSWER_MESSAGES.section(section.title));
    invalidSectionTitles.push(section.title);
  });

  return { questionErrors, sectionErrors, invalidSectionTitles };
}
