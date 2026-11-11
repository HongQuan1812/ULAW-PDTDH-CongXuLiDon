/* Kiểm tra bản soạn loại đơn trước khi lưu (như checkDraft() của artifact/js/forms-page.js).
   Trình soạn dùng để báo lỗi và tô đỏ ô sai; API giả và backend dùng lại để kiểm tra lần cuối, nên câu báo giống nhau. */
import type { FormSection } from '../aux-schema/form-types--sections';
import type { FormTypeStatus } from '../aux-schema/form-types--statuses';
import { COMMON_EXPORT_TAGS, EXPORT_TAG_PATTERN, ROW_NUMBER_TAG, columnTag, questionTag } from '../business-rules/exports--tags';

/** Câu báo lỗi của bản soạn loại đơn. "Phần 1, câu 2" đếm như trình soạn: câu hỏi đếm cả khối thông báo. */
export const FORM_TYPE_DRAFT_MESSAGES = {
  nameRequired: 'Nhập tên loại đơn.',
  prefixFormat: 'Mã đơn gồm 2–5 chữ in hoa.',
  /** Mã đơn trùng loại đơn khác (máy chủ trả 409 với câu này) */
  prefixTaken: (prefix: string) => `Mã ${prefix} đã được loại đơn khác dùng.`,
  sectionTitleRequired: (sectionNumber: number) => `Phần ${sectionNumber}: nhập tiêu đề phần.`,
  questionLabelRequired: (sectionNumber: number, questionNumber: number) => `Phần ${sectionNumber}, câu ${questionNumber}: nhập nội dung câu hỏi.`,
  emptyOption: (sectionNumber: number, questionNumber: number) => `Phần ${sectionNumber}, câu ${questionNumber}: lựa chọn không được để trống.`,
  emptyColumn: (sectionNumber: number, questionNumber: number) => `Phần ${sectionNumber}, câu ${questionNumber}: đặt tên cho mọi cột.`,
  noFileFormat: (sectionNumber: number, questionNumber: number) => `Phần ${sectionNumber}, câu ${questionNumber}: chọn ít nhất một định dạng tệp.`,
  openWithoutQuestion: 'Loại đơn đang mở phải có ít nhất một câu hỏi.',
  /** Mã dùng trong file Word sai dạng */
  tagFormat: (sectionNumber: number, questionNumber: number) =>
    `Phần ${sectionNumber}, câu ${questionNumber}: mã trường chỉ gồm chữ thường không dấu, số và dấu _, không bắt đầu bằng số.`,
  /** Mã của câu hỏi (hoặc của một cột) trùng mã có sẵn */
  tagReserved: (sectionNumber: number, questionNumber: number, tag: string) =>
    `Phần ${sectionNumber}, câu ${questionNumber}: mã {${tag}} trùng mã có sẵn, hãy đặt mã khác.`,
  /** Mã của câu hỏi (hoặc của một cột) trùng mã đã dùng ở câu trước */
  tagTaken: (sectionNumber: number, questionNumber: number, tag: string, usedAt: string, isColumn: boolean) =>
    `Phần ${sectionNumber}, câu ${questionNumber}: mã {${tag}} trùng với ${usedAt}. Đặt mã trường khác${isColumn ? ' hoặc đổi tên cột' : ''}.`,
} as const;

/** Mã đơn hợp lệ: 2–5 chữ in hoa không dấu. */
export const FORM_TYPE_PREFIX_PATTERN = /^[A-Z]{2,5}$/;

/**
 * Chỗ bị lỗi trong trình soạn, để tô đỏ đúng ô. Mỗi hàm trả một chuỗi riêng cho một ô.
 * Lỗi không gắn với ô nào (vd loại đơn đang mở chưa có câu hỏi) thì target là null.
 */
export const FORM_TYPE_ISSUE_TARGET = {
  name: 'name',
  prefix: 'prefix',
  sectionTitle: (sectionId: string) => `section-title:${sectionId}`,
  questionLabel: (questionId: string) => `question-label:${questionId}`,
  option: (questionId: string, optionIndex: number) => `option:${questionId}:${optionIndex}`,
  column: (questionId: string, columnIndex: number) => `column:${questionId}:${columnIndex}`,
  fileFormats: (questionId: string) => `file-formats:${questionId}`,
  questionTag: (questionId: string) => `question-tag:${questionId}`,
} as const;

/** Một lỗi của bản soạn: câu báo và ô bị lỗi (null = không gắn với ô nào). */
export interface FormTypeIssue {
  target: string | null;
  message: string;
}

/** Phần bản soạn cần kiểm tra. */
export interface FormTypeDraftInput {
  name: string;
  prefix: string;
  status: FormTypeStatus;
  sections: readonly FormSection[];
}

/**
 * Kiểm tra bản soạn loại đơn.
 * @param draft          bản soạn
 * @param otherPrefixes  mã đơn của các loại đơn khác, để báo trùng
 * @returns              các lỗi theo thứ tự trên trình soạn (từ trên xuống); hợp lệ thì []
 */
export function validateFormTypeDraft(draft: FormTypeDraftInput, otherPrefixes: readonly string[]): FormTypeIssue[] {
  const issues: FormTypeIssue[] = [];
  const add = (target: string | null, message: string) => issues.push({ target, message });

  // Thông tin chung
  if (!draft.name.trim()) add(FORM_TYPE_ISSUE_TARGET.name, FORM_TYPE_DRAFT_MESSAGES.nameRequired);
  if (!FORM_TYPE_PREFIX_PATTERN.test(draft.prefix)) add(FORM_TYPE_ISSUE_TARGET.prefix, FORM_TYPE_DRAFT_MESSAGES.prefixFormat);
  else if (otherPrefixes.includes(draft.prefix)) add(FORM_TYPE_ISSUE_TARGET.prefix, FORM_TYPE_DRAFT_MESSAGES.prefixTaken(draft.prefix));

  // Từng phần, từng câu hỏi
  draft.sections.forEach((section, sectionIndex) => {
    const sectionNumber = sectionIndex + 1;
    if (!section.title.trim()) add(FORM_TYPE_ISSUE_TARGET.sectionTitle(section.id), FORM_TYPE_DRAFT_MESSAGES.sectionTitleRequired(sectionNumber));

    section.questions.forEach((question, questionIndex) => {
      const questionNumber = questionIndex + 1;
      if (question.type !== 'info' && !question.label.trim()) {
        add(FORM_TYPE_ISSUE_TARGET.questionLabel(question.id), FORM_TYPE_DRAFT_MESSAGES.questionLabelRequired(sectionNumber, questionNumber));
      }
      if (question.type === 'radio' || question.type === 'check' || question.type === 'select') {
        const emptyIndexes = question.options.flatMap((option, i) => (option.trim() ? [] : [i]));
        emptyIndexes.forEach((i) => add(FORM_TYPE_ISSUE_TARGET.option(question.id, i), FORM_TYPE_DRAFT_MESSAGES.emptyOption(sectionNumber, questionNumber)));
      }
      if (question.type === 'table') {
        const emptyIndexes = question.columns.flatMap((column, i) => (column.label.trim() ? [] : [i]));
        emptyIndexes.forEach((i) => add(FORM_TYPE_ISSUE_TARGET.column(question.id, i), FORM_TYPE_DRAFT_MESSAGES.emptyColumn(sectionNumber, questionNumber)));
      }
      if (question.type === 'file' && !question.accept.length) {
        add(FORM_TYPE_ISSUE_TARGET.fileFormats(question.id), FORM_TYPE_DRAFT_MESSAGES.noFileFormat(sectionNumber, questionNumber));
      }
    });
  });

  // Mã dùng trong file Word: đúng dạng, không trùng mã có sẵn, không trùng nhau (kể cả mã cột của bảng)
  const tagUsedAt = new Map<string, string>();
  draft.sections.forEach((section, sectionIndex) => {
    section.questions.forEach((question, questionIndex) => {
      if (question.type === 'info') return;
      const [sectionNumber, questionNumber] = [sectionIndex + 1, questionIndex + 1];
      const target = FORM_TYPE_ISSUE_TARGET.questionTag(question.id);
      const ownTag = questionTag(question);
      if (!EXPORT_TAG_PATTERN.test(ownTag)) add(target, FORM_TYPE_DRAFT_MESSAGES.tagFormat(sectionNumber, questionNumber));
      // Câu hỏi / cột chưa có tên (đã báo lỗi ở trên) thì chưa có mã để so trùng
      const tags = [question.tag || question.label.trim() ? ownTag : null, ...(question.type === 'table' ? question.columns.map((column) => (column.tag || column.label.trim() ? columnTag(column) : null)) : [])];
      tags.forEach((tag, i) => {
        if (tag === null) return;
        const usedAt = tagUsedAt.get(tag);
        if (COMMON_EXPORT_TAGS.has(tag) || tag === ROW_NUMBER_TAG) add(target, FORM_TYPE_DRAFT_MESSAGES.tagReserved(sectionNumber, questionNumber, tag));
        else if (usedAt) add(target, FORM_TYPE_DRAFT_MESSAGES.tagTaken(sectionNumber, questionNumber, tag, usedAt, i > 0));
        else tagUsedAt.set(tag, `phần ${sectionNumber}, câu ${questionNumber}`);
      });
    });
  });

  // Loại đơn đang mở phải có câu hỏi để trả lời
  const questionCount = draft.sections.reduce((count, section) => count + section.questions.filter((question) => question.type !== 'info').length, 0);
  if (draft.status === 'open' && !questionCount) add(null, FORM_TYPE_DRAFT_MESSAGES.openWithoutQuestion);

  return issues;
}

/**
 * Các câu báo lỗi để hiện thành danh sách: bỏ câu trùng (vd hai lựa chọn trống cùng một câu hỏi), giữ thứ tự.
 * @param issues  lỗi từ validateFormTypeDraft
 * @returns       các câu báo, mỗi câu một lần
 */
export function issueMessages(issues: readonly FormTypeIssue[]): string[] {
  return [...new Set(issues.map((issue) => issue.message))];
}
