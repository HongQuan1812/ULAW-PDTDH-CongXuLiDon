/* Thay đổi chưa lưu về mẫu xuất file của một loại đơn (như tệp người nộp đơn vừa chọn, xem form-renderer/localFiles.ts):
   thêm (file giữ trong trình duyệt), đổi tên, xóa chỉ ghi nhận ở đây; bấm Lưu ở trình soạn mới gửi lên máy chủ trong một lần.
   Mẫu thuộc loại đơn (mọi phiên bản), nên thay đổi này không theo phiên bản đang soạn.
   Mẫu xuất file đơn và mẫu xuất file thống kê dùng chung một bộ thay đổi; mỗi khung chỉ hiện các mẫu cùng mục đích. */
import { EXPORT_TEMPLATE_FILE, type ExportTemplate, type ExportTemplatePurpose, type SaveExportTemplatesRequest } from '@ulaw/shared';

/** Mẫu mới chọn từ máy, chưa tải lên. */
export interface StagedTemplate {
  /** Id tạm, dạng 'local-…'; cũng là tên trường multipart chứa file khi lưu */
  tempId: string;
  /** Mẫu xuất file đơn (Word) hay thống kê (Excel) */
  purpose: ExportTemplatePurpose;
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
 * @param file     file .docx / .xlsx (đã kiểm tra đuôi)
 * @param purpose  mẫu xuất file đơn hay thống kê
 * @returns        mẫu mới, tên mẫu = tên file bỏ đuôi
 */
export function stageTemplate(file: File, purpose: ExportTemplatePurpose): StagedTemplate {
  const extension = EXPORT_TEMPLATE_FILE[purpose].extension;
  const name = file.name.toLowerCase().endsWith(extension) ? file.name.slice(0, -extension.length) : file.name;
  return { tempId: `local-${crypto.randomUUID()}`, purpose, name, file };
}

/**
 * Danh sách mẫu đang hiện của một mục đích: mẫu đã lưu (bỏ mẫu sắp xóa, tên theo tên mới), rồi mẫu mới chưa lưu.
 * @param savedTemplates  mẫu ở máy chủ (mọi mục đích)
 * @param changes         các thay đổi chưa lưu
 * @param purpose         chỉ lấy mẫu xuất file đơn hay thống kê
 * @returns               các dòng theo thứ tự hiện
 */
export function templateRows(savedTemplates: readonly ExportTemplate[], changes: ExportTemplateChanges, purpose: ExportTemplatePurpose): TemplateRow[] {
  const removed = new Set(changes.removed);
  return [
    ...savedTemplates
      .filter((template) => template.purpose === purpose && !removed.has(template.id))
      .map((template): TemplateRow => ({ kind: 'saved', id: template.id, name: changes.renamed[template.id] ?? template.name, template })),
    ...changes.added
      .filter((staged) => staged.purpose === purpose)
      .map((staged): TemplateRow => ({ kind: 'staged', id: staged.tempId, name: staged.name, staged })),
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
      added: changes.added.map(({ tempId, name, purpose }) => ({ tempId, name, purpose })),
    },
    filesByTempId: new Map(changes.added.map((staged) => [staged.tempId, staged.file])),
  };
}
