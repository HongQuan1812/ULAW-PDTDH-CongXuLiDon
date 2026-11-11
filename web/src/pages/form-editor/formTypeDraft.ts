/* Bản đang soạn của một loại đơn và các phép sửa trên đó (như formDrafts, newQuestion, newSection, withTypeDefaults
   và các nút trong artifact/js/forms-page.js). Mọi hàm đều thuần: nhận bản cũ, trả bản mới, không sửa bản cũ. */
import type { FormSection, FormTypeStatus, FormTypeVersion, Question, QuestionType } from '@ulaw/shared';

/** Phần thông tin chung và nội dung của loại đơn mà trình soạn sửa được. */
export interface FormTypeDraft {
  name: string;
  prefix: string;
  /** Mô tả ngắn; '' = không có */
  description: string;
  status: FormTypeStatus;
  sections: FormSection[];
}

/** Câu hỏi có danh sách lựa chọn. */
export const CHOICE_QUESTION_TYPES: readonly QuestionType[] = ['radio', 'check', 'select'];

/** Các nhóm định dạng tệp người soạn chọn được (như ACCEPTS của bản mẫu): [các đuôi tệp, tên hiện]. */
export const FILE_FORMAT_GROUPS: readonly [readonly string[], string][] = [
  [['pdf'], 'PDF'],
  [['jpg', 'png'], 'Ảnh JPG, PNG'],
  [['doc', 'docx'], 'Word'],
  [['xls', 'xlsx'], 'Excel'],
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
 * Bản soạn của loại đơn mới (như "+ Tạo loại đơn"): trạng thái Nháp, một phần, một câu hỏi trống.
 * @returns  bản soạn
 */
export function newFormTypeDraft(): FormTypeDraft {
  return { name: '', prefix: '', description: '', status: 'draft', sections: [newSection()] };
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
    status: version.status,
    sections: structuredClone(version.sections),
  };
}

/**
 * Đổi loại câu hỏi, giữ id, nội dung, mô tả; thêm thuộc tính mặc định của loại mới (như withTypeDefaults của bản mẫu).
 * Lựa chọn, cột bảng, định dạng tệp đang có thì giữ lại khi loại mới cũng dùng.
 * @param question  câu hỏi đang soạn
 * @param type      loại mới
 * @returns         câu hỏi mới; khối thông báo thì không còn "Bắt buộc"
 */
export function changeQuestionType(question: Question, type: QuestionType): Question {
  const base = { id: question.id, label: question.label, help: question.help ?? '' };
  const required = 'required' in question ? question.required : false;

  // Khối thông báo: không cần trả lời
  if (type === 'info') return { ...base, type };

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
  return { ...base, required, type };
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
 * Mã đơn người soạn gõ: bỏ dấu, chỉ giữ chữ in hoa A–Z, tối đa 5 chữ (như ô prefix của bản mẫu).
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
