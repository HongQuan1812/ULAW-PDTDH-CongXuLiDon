/* Bản đang soạn của một loại đơn và các phép sửa trên đó. Mọi hàm đều thuần: nhận bản cũ, trả bản mới, không sửa bản cũ. */
import { EMPTY_RICH_TEXT_DOC, PLACEHOLDER_QUESTION_TYPES, type FormSection, FormTypeStatus, FormTypeVersion, Question, QuestionType } from '@ulaw/shared';

/** Phần thông tin chung và nội dung của loại đơn mà trình soạn sửa được. */
export interface FormTypeDraft {
  name: string;
  prefix: string;
  /** Mô tả ngắn; '' = không có */
  description: string;
  /** Thời gian xử lí tối đa, ngày làm việc; null = không có hạn */
  maxProcessingDays: number | null;
  status: FormTypeStatus;
  sections: FormSection[];
}

/** Câu hỏi có danh sách lựa chọn. */
export const CHOICE_QUESTION_TYPES: readonly QuestionType[] = ['radio', 'check', 'select'];

/** Các nhóm định dạng tệp người soạn chọn được: [các đuôi tệp, tên hiện]. */
export const FILE_FORMAT_GROUPS: readonly [readonly string[], string][] = [
  [['jpg', 'png'], 'Ảnh JPG, PNG'],
  [['doc', 'docx'], 'Word'],
  [['pdf'], 'PDF'],
];

/** Dung lượng tối đa mỗi tệp (MB) khi tạo câu hỏi tải tệp, và giới hạn người soạn đặt được. */
export const DEFAULT_MAX_MB = 10;
export const MAX_MB_LIMIT = 50;

/**
 * Id mới cho phần, câu hỏi: tiền tố và 8 kí tự ngẫu nhiên, vd 'q-1a2b3c4d'.
 * @param prefix  's' cho phần, 'q' cho câu hỏi
 * @returns       id chưa dùng
 */
function newId(prefix: 's' | 'q'): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Câu hỏi mới, chưa có nội dung.
 * @param type  loại câu hỏi, mặc định Trả lời ngắn
 * @returns     câu hỏi với thuộc tính mặc định của loại đó
 */
export function newQuestion(type: QuestionType = 'text'): Question {
  return changeQuestionType({ id: newId('q'), type: 'text', label: '', help: '', required: false }, type);
}

/**
 * Phần mới: chưa có tiêu đề, có sẵn một câu hỏi trống.
 * @returns  phần mới
 */
export function newSection(): FormSection {
  return { id: newId('s'), title: '', hint: '', main: false, questions: [newQuestion()] };
}

/**
 * Bản soạn của loại đơn mới (như "+ Tạo loại đơn"): trạng thái Nháp, không có hạn xử lí, một phần, một câu hỏi trống.
 * @returns  bản soạn
 */
export function newFormTypeDraft(): FormTypeDraft {
  return { name: '', prefix: '', description: '', maxProcessingDays: null, status: 'draft', sections: [newSection()] };
}

/**
 * Hai bản soạn có cùng nội dung không (không tính thứ tự khóa trong đối tượng, bỏ qua khóa mang giá trị undefined).
 * @param firstDraft   bản thứ nhất
 * @param secondDraft  bản thứ hai
 * @returns            true nếu giống hệt nhau
 */
export function sameDraft(firstDraft: FormTypeDraft, secondDraft: FormTypeDraft): boolean {
  return stableJson(firstDraft) === stableJson(secondDraft);
}

/**
 * Chuỗi JSON với khóa của mọi đối tượng xếp theo thứ tự chữ cái, để so nội dung.
 * @param input  giá trị cần đổi
 * @returns      chuỗi JSON
 */
function stableJson(input: unknown): string {
  return JSON.stringify(input, (_key, nested: unknown) =>
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey)))
      : nested,
  );
}

/**
 * Bản soạn từ một phiên bản đã lưu (bản sao, sửa không ảnh hưởng dữ liệu đã tải).
 * @param prefix   mã đơn của loại đơn
 * @param version  phiên bản tải từ máy chủ
 * @returns        bản soạn
 */
export function draftFromVersion(prefix: string, version: FormTypeVersion): FormTypeDraft {
  return {
    name: version.name,
    prefix,
    description: version.description ?? '',
    maxProcessingDays: version.maxProcessingDays,
    status: version.status,
    sections: structuredClone(version.sections),
  };
}

/**
 * Đổi loại câu hỏi, giữ id, nội dung, mô tả; thêm thuộc tính mặc định của loại mới.
 * Lựa chọn, cột bảng, định dạng tệp đang có thì giữ lại khi loại mới cũng dùng.
 * @param question  câu hỏi đang soạn
 * @param type      loại mới
 * @returns         câu hỏi mới; khối thông báo thì không còn "Bắt buộc"
 */
export function changeQuestionType(question: Question, type: QuestionType): Question {
  // Khối thông báo: chỉ có nội dung, không cần trả lời (đổi sang loại khác thì không mang nội dung theo)
  if (type === 'info') return question.type === 'info' ? question : { id: question.id, type, content: EMPTY_RICH_TEXT_DOC };
  const base = { id: question.id, label: 'label' in question ? question.label : '', help: 'help' in question ? (question.help ?? '') : '' };
  const required = 'required' in question ? question.required : false;

  // Loại có cài đặt riêng: lấy cài đặt đang có, không có thì dùng mặc định
  if (type === 'radio' || type === 'check' || type === 'select') {
    const options = 'options' in question && question.options.length ? question.options : ['Lựa chọn 1'];
    return { ...base, required, type, options: [...options] };
  }
  if (type === 'table') {
    return question.type === 'table'
      ? structuredClone(question)
      : { ...base, required, type, rowName: 'dòng', columns: [{ label: 'Cột 1', type: 'text' }] };
  }
  if (type === 'file') {
    return question.type === 'file' ? { ...question } : { ...base, required, type, accept: ['pdf', 'jpg', 'png'], maxMB: DEFAULT_MAX_MB };
  }
  // Trả lời ngắn, Đoạn văn, Số: giữ chữ gợi ý đang có; câu Ngày không có chữ gợi ý
  const placeholder = 'placeholder' in question && (PLACEHOLDER_QUESTION_TYPES as readonly string[]).includes(type) ? question.placeholder : undefined;
  return placeholder ? { ...base, required, type, placeholder } : { ...base, required, type };
}

/**
 * Chuyển một phần tử của mảng sang vị trí khác.
 * @param items  mảng
 * @param from   vị trí đang ở
 * @param to     vị trí mới
 * @returns      mảng mới; vị trí ngoài mảng thì trả bản sao không đổi
 */
export function moveItem<Item>(items: readonly Item[], from: number, to: number): Item[] {
  const next = [...items];
  if (to < 0 || to >= items.length || from === to) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/**
 * Nhân bản câu hỏi: bản sao có id mới, đứng ngay sau câu gốc.
 * @param questions  các câu hỏi của phần
 * @param index      vị trí câu gốc
 * @returns          các câu hỏi mới
 */
export function duplicateQuestion(questions: readonly Question[], index: number): Question[] {
  const copy = { ...structuredClone(questions[index]!), id: newId('q') };
  return [...questions.slice(0, index + 1), copy, ...questions.slice(index + 1)];
}

/**
 * Thay phần tử ở một vị trí.
 * @param items     mảng
 * @param index     vị trí
 * @param nextItem  phần tử mới
 * @returns         mảng mới
 */
export function replaceAt<Item>(items: readonly Item[], index: number, nextItem: Item): Item[] {
  return items.map((item, i) => (i === index ? nextItem : item));
}

/**
 * Bỏ phần tử ở một vị trí.
 * @param items  mảng
 * @param index  vị trí
 * @returns      mảng mới
 */
export function removeAt<Item>(items: readonly Item[], index: number): Item[] {
  return items.filter((_, i) => i !== index);
}

/**
 * Thêm một lựa chọn trống ngay dưới một lựa chọn (Enter ở cuối ô lựa chọn).
 * @param options  các lựa chọn
 * @param index    lựa chọn đang gõ
 * @returns        các lựa chọn mới; lựa chọn trống nằm ở index + 1
 */
export function insertEmptyOption(options: readonly string[], index: number): string[] {
  return [...options.slice(0, index + 1), '', ...options.slice(index + 1)];
}

/**
 * Dán chữ nhiều dòng vào ô lựa chọn: mỗi dòng (bỏ dòng trống) thành một lựa chọn, chèn tại con trỏ.
 * Chữ trước con trỏ ghép với dòng đầu, chữ sau con trỏ ghép với dòng cuối.
 * @param options        các lựa chọn
 * @param index          lựa chọn đang gõ
 * @param selectionStart đầu vùng chọn
 * @param selectionEnd   cuối vùng chọn
 * @param pastedText     chữ dán vào
 * @returns              các lựa chọn mới và vị trí lựa chọn cuối vừa dán; chữ dán chỉ một dòng thì null (để ô tự dán như thường)
 */
export function pasteOptions(
  options: readonly string[],
  index: number,
  selectionStart: number,
  selectionEnd: number,
  pastedText: string,
): { options: string[]; lastIndex: number } | null {
  const lines = pastedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  // Ghép chữ trước con trỏ vào dòng đầu, chữ sau con trỏ vào dòng cuối
  const option = options[index] ?? '';
  const pasted = [...lines];
  pasted[0] = option.slice(0, selectionStart) + pasted[0];
  pasted[pasted.length - 1] = pasted[pasted.length - 1] + option.slice(selectionEnd);
  return { options: [...options.slice(0, index), ...pasted, ...options.slice(index + 1)], lastIndex: index + pasted.length - 1 };
}

/**
 * Mã đơn người soạn gõ: bỏ dấu, chỉ giữ chữ in hoa A–Z, tối đa 5 chữ.
 * @param typed  chữ vừa gõ
 * @returns      mã đơn đã làm sạch, vd 'bl1' → 'BL', 'đơn' → 'DON'
 */
export function cleanPrefix(typed: string): string {
  return typed
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'D')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 5);
}
