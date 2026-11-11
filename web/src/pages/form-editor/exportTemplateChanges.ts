/* Thay đổi chưa lưu về mẫu xuất file của một loại đơn (như tệp người nộp đơn vừa chọn, xem form-renderer/localFiles.ts):
   thêm (file giữ trong trình duyệt), đổi tên, xóa chỉ ghi nhận ở đây; bấm Lưu ở trình soạn mới gửi lên máy chủ trong một lần.
   Mẫu thuộc loại đơn (mọi phiên bản), nên thay đổi này không theo phiên bản đang soạn. */
import type { ExportTemplate, SaveExportTemplatesRequest } from '@ulaw/shared';

/** Mẫu mới chọn từ máy, chưa tải lên. */
export interface StagedTemplate {
  /** Id tạm, dạng 'local-…'; cũng là tên trường multipart chứa file khi lưu */
  tempId: string;
  /** Tên mẫu, mặc định là tên file bỏ đuôi */
  name: string;
  file: File;
}

/** Các thay đổi chưa lưu về mẫu. */
export interface ExportTemplateChanges {
  added: StagedTemplate[];
  /** Tên mới theo id mẫu đã lưu */
  renamed: Record<string, string>;
  /** Id các mẫu đã lưu sẽ xóa */
  removed: string[];
}

/** Một dòng trong danh sách mẫu: mẫu đã lưu (kèm tên mới nếu có) hoặc mẫu mới chưa lưu. */
export type TemplateRow =
  | { kind: 'saved'; id: string; name: string; template: ExportTemplate }
  | { kind: 'staged'; id: string; name: string; staged: StagedTemplate };

export const NO_TEMPLATE_CHANGES: ExportTemplateChanges = { added: [], renamed: {}, removed: [] };

/**
 * Có thay đổi nào chưa lưu không.
 * @param changes  các thay đổi
 * @returns        true nếu có ít nhất một thêm / đổi tên / xóa
 */
export function hasTemplateChanges(changes: ExportTemplateChanges): boolean {
  return changes.added.length > 0 || changes.removed.length > 0 || Object.keys(changes.renamed).length > 0;
}

/**
 * Giữ một file vừa chọn làm mẫu mới.
 * @param file  file .docx (đã kiểm tra đuôi)
 * @returns     mẫu mới, tên mẫu = tên file bỏ đuôi
 */
export function stageTemplate(file: File): StagedTemplate {
  return { tempId: `local-${crypto.randomUUID()}`, name: file.name.replace(/\.docx$/i, ''), file };
}

/**
 * Danh sách mẫu đang hiện: mẫu đã lưu (bỏ mẫu sắp xóa, tên theo tên mới), rồi mẫu mới chưa lưu.
 * @param savedTemplates  mẫu ở máy chủ
 * @param changes         các thay đổi chưa lưu
 * @returns               các dòng theo thứ tự hiện
 */
export function templateRows(savedTemplates: readonly ExportTemplate[], changes: ExportTemplateChanges): TemplateRow[] {
  const removed = new Set(changes.removed);
  return [
    ...savedTemplates
      .filter((template) => !removed.has(template.id))
      .map((template): TemplateRow => ({ kind: 'saved', id: template.id, name: changes.renamed[template.id] ?? template.name, template })),
    ...changes.added.map((staged): TemplateRow => ({ kind: 'staged', id: staged.tempId, name: staged.name, staged })),
  ];
}

/**
 * Đổi tên một dòng: mẫu mới thì sửa thẳng; mẫu đã lưu thì ghi tên mới (đổi về đúng tên cũ thì bỏ ghi nhận).
 * @param changes  các thay đổi hiện tại
 * @param row      dòng cần đổi tên
 * @param name     tên mới (đã bỏ khoảng trắng đầu cuối, không trống)
 * @returns        các thay đổi mới
 */
export function renameRow(changes: ExportTemplateChanges, row: TemplateRow, name: string): ExportTemplateChanges {
  if (row.kind === 'staged') {
    return { ...changes, added: changes.added.map((staged) => (staged.tempId === row.id ? { ...staged, name } : staged)) };
  }
  const { [row.id]: _previousName, ...otherRenames } = changes.renamed;
  return { ...changes, renamed: name === row.template.name ? otherRenames : { ...otherRenames, [row.id]: name } };
}

/**
 * Bỏ một dòng: mẫu mới thì bỏ khỏi danh sách chờ; mẫu đã lưu thì ghi nhận sẽ xóa (bỏ cả tên mới nếu có).
 * @param changes  các thay đổi hiện tại
 * @param row      dòng cần bỏ
 * @returns        các thay đổi mới
 */
export function removeRow(changes: ExportTemplateChanges, row: TemplateRow): ExportTemplateChanges {
  if (row.kind === 'staged') return { ...changes, added: changes.added.filter((staged) => staged.tempId !== row.id) };
  const { [row.id]: _previousName, ...otherRenames } = changes.renamed;
  return { ...changes, renamed: otherRenames, removed: [...changes.removed, row.id] };
}

/**
 * Đổi các thay đổi thành dữ liệu gửi lên máy chủ.
 * @param changes  các thay đổi chưa lưu
 * @returns        changes: phần chữ của lệnh lưu · filesByTempId: file của các mẫu mới theo id tạm
 */
export function toSaveTemplatesRequest(changes: ExportTemplateChanges): { changes: SaveExportTemplatesRequest; filesByTempId: Map<string, File> } {
  return {
    changes: {
      removed: changes.removed,
      renamed: Object.entries(changes.renamed).map(([templateId, name]) => ({ templateId, name })),
      added: changes.added.map(({ tempId, name }) => ({ tempId, name })),
    },
    filesByTempId: new Map(changes.added.map((staged) => [staged.tempId, staged.file])),
  };
}
