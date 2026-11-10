/* Kiểm tra câu trả lời của lá đơn theo cấu trúc loại đơn (như check() của từng loại câu hỏi trong artifact/js/sections.js).
   Trang nộp đơn, API giả và backend cùng dùng validateAnswers(), nên câu báo lỗi giống nhau ở mọi nơi. */
import type { AnswerableQuestion, QuestionOf } from '../aux-schema/form-types--question-types';
import type { FormSection } from '../aux-schema/form-types--sections';
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
  /** Câu báo chung dưới nút Gửi đơn cho phần có lỗi */
  section: (sectionTitle: string) => `Kiểm tra lại phần “${sectionTitle}”.`,
} as const;

/**
 * Ô của bảng còn trống chưa.
 * @param cell  giá trị ô
 * @returns     true nếu null hoặc chuỗi chỉ có khoảng trắng
 */
export function isEmptyCell(cell: TableCell | undefined): boolean {
  return cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '');
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

/* ---------- Câu trả lời ---------- */

/** Chuỗi hay không. */
const isText = (value: unknown): value is string => typeof value === 'string';
/** Mảng chuỗi hay không. */
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);
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
    case 'text':
    case 'para': {
      const text = isText(value) ? value.trim() : '';
      return question.required && !text ? ANSWER_MESSAGES.required : '';
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

      // Cột số chỉ nhận số không âm
      for (const [index, column] of columns.entries()) {
        if (column.type !== 'number') continue;
        const valid = rows.every((row) => {
          const cell = (row as TableCell[])[index];
          return typeof cell === 'number' && Number.isFinite(cell) && cell >= 0;
        });
        if (!valid) return ANSWER_MESSAGES.tableNumberInvalid(column.label);
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
}

/**
 * Kiểm tra mọi câu trả lời của lá đơn theo cấu trúc loại đơn.
 * @param sections  các phần của loại đơn
 * @param answers   câu trả lời theo id câu hỏi
 * @returns         lỗi từng câu và câu báo chung từng phần; không có lỗi thì cả hai đều trống
 */
export function validateAnswers(sections: readonly FormSection[], answers: FormAnswers): AnswersValidation {
  const questionErrors: Record<string, string> = {};
  const sectionErrors: string[] = [];

  sections.forEach((section) => {
    let sectionHasError = false;
    section.questions.filter(isAnswerable).forEach((question) => {
      const message = validateAnswer(question, answers[question.id]);
      if (!message) return;
      questionErrors[question.id] = message;
      sectionHasError = true;
    });
    if (sectionHasError) sectionErrors.push(ANSWER_MESSAGES.section(section.title));
  });

  return { questionErrors, sectionErrors };
}
