/* Xử lí câu trả lời của một lá đơn: tìm các tệp trong câu trả lời, ghép câu trả lời mới đè lên câu trả lời cũ. */
import { isAnswerable, type FileRef, type FormAnswers, type FormSection } from '@ulaw/shared';

/**
 * Mọi tệp trong câu trả lời của các câu hỏi tải tệp.
 * @param sections  các phần của loại đơn
 * @param answers   câu trả lời theo id câu hỏi
 * @returns         các FileRef
 */
export function fileRefsIn(sections: readonly FormSection[], answers: FormAnswers): FileRef[] {
  return sections
    .flatMap((section) => section.questions)
    .filter((question) => question.type === 'file')
    .flatMap((question) => (Array.isArray(answers[question.id]) ? (answers[question.id] as FileRef[]) : []));
}

/**
 * Câu trả lời đem lưu: chỉ lấy câu trả lời của câu hỏi có trong loại đơn, đè lên câu trả lời cũ
 * (câu trả lời cũ của câu hỏi không còn trong loại đơn vẫn giữ). Tệp đã lưu giữ nguyên;
 * tệp mới được thay bằng FileRef đã lưu (id, tên, dung lượng ở máy chủ).
 * @param sections    các phần của loại đơn lúc nộp
 * @param answers     câu trả lời đã kiểm tra; tệp mới mang id tạm
 * @param oldAnswers  câu trả lời đang lưu ({} khi nộp đơn mới)
 * @param savedFiles  FileRef của tệp mới theo id tạm
 * @returns           câu trả lời mới
 */
export function mergeAnswers(
  sections: readonly FormSection[],
  answers: FormAnswers,
  oldAnswers: FormAnswers,
  savedFiles: ReadonlyMap<string, FileRef>,
): FormAnswers {
  const keptFiles = new Map(fileRefsIn(sections, oldAnswers).map((file) => [file.id, file]));
  const storedAnswers: FormAnswers = { ...oldAnswers };
  for (const question of sections.flatMap((section) => section.questions).filter(isAnswerable)) {
    const answer = answers[question.id];
    if (answer === undefined) continue;
    storedAnswers[question.id] =
      question.type === 'file' && Array.isArray(answer)
        ? (answer as FileRef[]).map((file) => keptFiles.get(file.id) ?? savedFiles.get(file.id)!)
        : answer;
  }
  return storedAnswers;
}
