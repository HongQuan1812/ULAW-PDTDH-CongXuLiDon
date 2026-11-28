/* Kiểm tra bản soạn loại đơn trước khi lưu.
   Trình soạn dùng để báo lỗi và tô đỏ ô sai; API giả và backend dùng lại để kiểm tra lần cuối, nên câu báo giống nhau. */
import { FORM_TYPE_TIME_MESSAGES, type FormTypeTimeSettings, type SaveFormTypeTimeSettingsRequest } from '../api-contract/form-types';
import type { FormSection } from '../aux-schema/form-types--sections';
import { MaxProcessingDaysSchema } from '../aux-schema/forms--deadlines';
import type { FormTypeStatus } from '../aux-schema/form-types--statuses';
import { COMMON_EXPORT_TAGS, EXPORT_TAG_PATTERN, FORM_COUNT_TAG, FORM_NUMBER_TAG, columnTag, questionTag, rowNumberTag } from '../business-rules/exports--tags';

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
  /** Cột kiểu Chọn có lựa chọn trống (hoặc chưa có lựa chọn nào) */
  emptyColumnOption: (sectionNumber: number, questionNumber: number) =>
    `Phần ${sectionNumber}, câu ${questionNumber}: cột kiểu Chọn cần ít nhất một lựa chọn, lựa chọn không được để trống.`,
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
  maxProcessingDays: 'max-processing-days',
  sectionTitle: (sectionId: string) => `section-title:${sectionId}`,
  questionLabel: (questionId: string) => `question-label:${questionId}`,
  option: (questionId: string, optionIndex: number) => `option:${questionId}:${optionIndex}`,
  column: (questionId: string, columnIndex: number) => `column:${questionId}:${columnIndex}`,
  /** Một lựa chọn của cột kiểu Chọn; optionIndex null = cột chưa có lựa chọn nào */
  columnOption: (questionId: string, columnIndex: number, optionIndex: number | null) =>
    `column-option:${questionId}:${columnIndex}:${optionIndex ?? 'none'}`,
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
  /** Thời gian xử lí tối đa, ngày làm việc; null = không có hạn */
  maxProcessingDays: number | null;
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
  const maxDaysCheck = MaxProcessingDaysSchema.safeParse(draft.maxProcessingDays);
  if (!maxDaysCheck.success) add(FORM_TYPE_ISSUE_TARGET.maxProcessingDays, maxDaysCheck.error.issues[0]!.message);

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

        // Cột kiểu Chọn: cần ít nhất một lựa chọn, không lựa chọn nào trống
        question.columns.forEach((column, columnIndex) => {
          if (column.type !== 'select') return;
          const options = column.options ?? [];
          const optionMessage = FORM_TYPE_DRAFT_MESSAGES.emptyColumnOption(sectionNumber, questionNumber);
          if (!options.length) add(FORM_TYPE_ISSUE_TARGET.columnOption(question.id, columnIndex, null), optionMessage);
          options.forEach((option, optionIndex) => {
            if (!option.trim()) add(FORM_TYPE_ISSUE_TARGET.columnOption(question.id, columnIndex, optionIndex), optionMessage);
          });
        });
      }
      if (question.type === 'file' && !question.accept.length) {
        add(FORM_TYPE_ISSUE_TARGET.fileFormats(question.id), FORM_TYPE_DRAFT_MESSAGES.noFileFormat(sectionNumber, questionNumber));
      }
    });
  });

  // Mã dùng trong file Word: đúng dạng, không trùng mã có sẵn, không trùng nhau (kể cả mã cột và mã số thứ tự dòng {<bảng>_stt} của bảng)
  const tagUsedAt = new Map<string, string>();
  draft.sections.forEach((section, sectionIndex) => {
    section.questions.forEach((question, questionIndex) => {
      if (question.type === 'info') return;
      const [sectionNumber, questionNumber] = [sectionIndex + 1, questionIndex + 1];
      const target = FORM_TYPE_ISSUE_TARGET.questionTag(question.id);
      const ownTag = questionTag(question);
      if (!EXPORT_TAG_PATTERN.test(ownTag)) add(target, FORM_TYPE_DRAFT_MESSAGES.tagFormat(sectionNumber, questionNumber));
      // Câu hỏi / cột chưa có tên (đã báo lỗi ở trên) thì chưa có mã để so trùng
      const hasOwnTag = Boolean(question.tag || question.label.trim());
      const tags = [hasOwnTag ? ownTag : null, ...(question.type === 'table' ? question.columns.map((column) => (column.tag || column.label.trim() ? columnTag(question, column) : null)) : [])];
      const ownRowNumberTag = question.type === 'table' && hasOwnTag ? rowNumberTag(ownTag) : null;
      tags.forEach((tag, i) => {
        if (tag === null) return;
        const usedAt = tagUsedAt.get(tag);
        const reserved = COMMON_EXPORT_TAGS.has(tag) || tag === FORM_NUMBER_TAG || tag === FORM_COUNT_TAG || tag === ownRowNumberTag;
        if (reserved) add(target, FORM_TYPE_DRAFT_MESSAGES.tagReserved(sectionNumber, questionNumber, tag));
        else if (usedAt) add(target, FORM_TYPE_DRAFT_MESSAGES.tagTaken(sectionNumber, questionNumber, tag, usedAt, i > 0));
        else tagUsedAt.set(tag, `phần ${sectionNumber}, câu ${questionNumber}`);
      });
      // Mã số thứ tự dòng của bảng cũng là mã đã dùng: câu hỏi khác không đặt trùng được
      if (ownRowNumberTag) {
        const usedAt = tagUsedAt.get(ownRowNumberTag);
        if (usedAt) add(target, FORM_TYPE_DRAFT_MESSAGES.tagTaken(sectionNumber, questionNumber, ownRowNumberTag, usedAt, false));
        else tagUsedAt.set(ownRowNumberTag, `phần ${sectionNumber}, câu ${questionNumber}`);
      }
    });
  });

  // Loại đơn đang mở phải có câu hỏi để trả lời
  const questionCount = draft.sections.reduce((count, section) => count + section.questions.filter((question) => question.type !== 'info').length, 0);
  if (draft.status === 'open' && !questionCount) add(null, FORM_TYPE_DRAFT_MESSAGES.openWithoutQuestion);

  return issues;
}

/** Ô của khung Cấu hình thời gian, để tô đỏ đúng ô. */
export const FORM_TYPE_TIME_ISSUE_TARGET = {
  maxProcessingDays: FORM_TYPE_ISSUE_TARGET.maxProcessingDays,
  autoOpenAt: 'auto-open-at',
  autoOpenVersion: 'auto-open-version',
  autoCloseAt: 'auto-close-at',
} as const;

/**
 * Kiểm tra cấu hình thời gian trước khi lưu (khung Cấu hình thời gian, API giả, backend cùng dùng).
 * Giờ hẹn mới hoặc vừa sửa phải sau phút hiện tại (gõ nhầm ngày đã qua thì loại đơn tự mở / đóng ngay mà không ai hay);
 * giờ giữ nguyên thì không xét (vd giờ đã chạy, có dấu ✓).
 * @param settings  cấu hình gửi lên (dạng đã đúng theo SaveFormTypeTimeSettingsRequestSchema)
 * @param versions  số các phiên bản hiện có của loại đơn
 * @param previous  cấu hình đang lưu, để biết giờ nào vừa sửa
 * @param now       lúc lưu, giờ Việt Nam 'YYYY-MM-DDTHH:mm' (phần giây trở đi bỏ qua)
 * @returns         các lỗi theo thứ tự trong khung (từ trên xuống); hợp lệ thì []
 */
export function validateFormTypeTimeSettings(
  settings: SaveFormTypeTimeSettingsRequest,
  versions: readonly number[],
  previous: FormTypeTimeSettings,
  now: string,
): FormTypeIssue[] {
  const issues: FormTypeIssue[] = [];
  const minute = now.slice(0, 16);

  // Thời gian xử lí: để trống hoặc số nguyên 1–365
  const maxDaysCheck = MaxProcessingDaysSchema.safeParse(settings.maxProcessingDays);
  if (!maxDaysCheck.success) issues.push({ target: FORM_TYPE_TIME_ISSUE_TARGET.maxProcessingDays, message: maxDaysCheck.error.issues[0]!.message });

  // Giờ tự mở: vừa sửa giờ thì phải sau thời điểm hiện tại; phiên bản phải có thật
  const { autoOpen, autoClose } = settings;
  const isOpenChanged = Boolean(autoOpen && previous.autoOpen?.at !== autoOpen.at);
  if (autoOpen && isOpenChanged && autoOpen.at <= minute) {
    issues.push({ target: FORM_TYPE_TIME_ISSUE_TARGET.autoOpenAt, message: FORM_TYPE_TIME_MESSAGES.inThePast });
  }
  if (autoOpen && !versions.includes(autoOpen.version)) {
    issues.push({ target: FORM_TYPE_TIME_ISSUE_TARGET.autoOpenVersion, message: FORM_TYPE_TIME_MESSAGES.versionMissing(autoOpen.version) });
  }

  // Giờ tự đóng: vừa sửa thì phải sau thời điểm hiện tại
  const isCloseChanged = Boolean(autoClose && previous.autoClose?.at !== autoClose.at);
  if (autoClose && isCloseChanged && autoClose.at <= minute) {
    issues.push({ target: FORM_TYPE_TIME_ISSUE_TARGET.autoCloseAt, message: FORM_TYPE_TIME_MESSAGES.inThePast });
  }

  // Giờ tự đóng: sau giờ tự mở (cả hai cùng dạng 'YYYY-MM-DDTHH:mm' nên so chuỗi là đủ)
  if (autoOpen && autoClose && autoClose.at <= autoOpen.at) {
    issues.push({ target: FORM_TYPE_TIME_ISSUE_TARGET.autoCloseAt, message: FORM_TYPE_TIME_MESSAGES.closeBeforeOpen });
  }

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
