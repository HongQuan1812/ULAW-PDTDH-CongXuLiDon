/* Kiểm tra dữ liệu mẫu theo đúng luật của hệ thống (trình soạn loại đơn, trang nộp đơn, mã đơn).
   Test và code nạp seed (api/prisma/seed.ts) cùng gọi, nên dữ liệu mẫu sai luật thì không nạp được. */
import { validateAnswers, validateFile, validateFormTypeDraft } from '../validators';
import { seedFormTypes } from './form-types';
import { seedForms } from './forms';

/** Dạng mã đơn: <TIỀN TỐ 2–5 chữ in hoa>-<NĂM>-<PHIÊN BẢN 3 số>-<STT 5 số>. */
const FORM_CODE_FORMAT = /^[A-Z]{2,5}-\d{4}-\d{3}-\d{5}$/;

/**
 * Kiểm tra mọi loại đơn mẫu (mọi phiên bản) và mọi đơn mẫu.
 * - Loại đơn: qua bộ kiểm tra của trình soạn (mã không trùng, đúng dạng, đủ tên, đủ lựa chọn…).
 * - Đơn: câu trả lời hợp lệ theo bản chụp loại đơn, tệp đúng định dạng và dung lượng, mã đơn đúng dạng và khớp tiền tố loại đơn.
 * @returns  các câu mô tả chỗ sai, mỗi lỗi một câu; dữ liệu mẫu hợp lệ thì []
 */
export function findSeedProblems(): string[] {
  const problems: string[] = [];
  const formTypes = seedFormTypes();
  const prefixByFormTypeId = new Map(formTypes.map((formType) => [formType.id, formType.prefix]));

  // Loại đơn: bộ kiểm tra của trình soạn
  for (const formType of formTypes) {
    const otherPrefixes = formTypes.filter((other) => other.id !== formType.id).map((other) => other.prefix);
    for (const version of formType.versions) {
      const draft = { name: version.name, prefix: formType.prefix, status: version.status, sections: version.sections };
      for (const issue of validateFormTypeDraft(draft, otherPrefixes)) {
        problems.push(`Loại đơn ${formType.id} v${version.version}: ${issue.message}`);
      }
    }
  }

  // Đơn: câu trả lời, tệp, mã đơn
  for (const form of seedForms()) {
    const { questionErrors } = validateAnswers(form.formTypeSnapshot.sections, form.answers);
    for (const [questionId, message] of Object.entries(questionErrors)) problems.push(`Đơn ${form.code}, câu ${questionId}: ${message}`);

    for (const question of form.formTypeSnapshot.sections.flatMap((section) => section.questions)) {
      if (question.type !== 'file') continue;
      const files = (form.answers[question.id] ?? []) as { name: string; sizeBytes: number }[];
      for (const file of files) {
        const message = validateFile(question, file.name, file.sizeBytes);
        if (message) problems.push(`Đơn ${form.code}, tệp ${file.name}: ${message}`);
      }
    }

    if (!FORM_CODE_FORMAT.test(form.code)) problems.push(`Đơn ${form.code}: mã đơn sai dạng.`);
    if (!form.code.startsWith(`${prefixByFormTypeId.get(form.formTypeId)}-`)) problems.push(`Đơn ${form.code}: tiền tố không khớp loại đơn ${form.formTypeId}.`);
  }

  return problems;
}

/**
 * Dừng ngay (ném lỗi) nếu dữ liệu mẫu sai luật; gọi trước khi nạp seed vào database.
 * @throws Error  liệt kê mọi chỗ sai
 */
export function assertSeedValid(): void {
  const problems = findSeedProblems();
  if (problems.length) throw new Error(`Dữ liệu mẫu sai luật, không nạp:\n- ${problems.join('\n- ')}`);
}
