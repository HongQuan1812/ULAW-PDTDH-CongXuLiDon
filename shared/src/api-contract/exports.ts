/* HỢP ĐỒNG nhóm API xuất file theo mẫu Word: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này.

   Mỗi loại đơn có các mẫu xuất file (file Word .docx có mã trường trong ngoặc nhọn, xem business-rules/exports--tags.ts),
   lưu ở máy chủ theo loại đơn (dùng chung mọi phiên bản). Cán bộ quản lí mẫu ở trình soạn loại đơn:
   thêm, đổi tên, xóa mẫu chỉ ghi nhận trong trình duyệt; bấm Lưu thì gửi mọi thay đổi cùng các file mới trong MỘT lần
   (như nộp đơn kèm tệp). Mẫu chưa lưu vẫn kiểm tra mã được bằng cách gửi kèm file.
   Máy chủ điền mẫu (docxtemplater) và trả file Word; định dạng của mẫu (font, bảng, căn lề) giữ nguyên.
   Các lệnh trả file (xem mẫu gốc, xuất file) trả nội dung .docx, không phải JSON;
   tên file trong Content-Disposition. */
import { z } from 'zod';
import type { FormSection } from '../aux-schema/form-types--sections';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const EXPORT_ENDPOINTS = {
  /** GET → ExportTemplatesResponse: các mẫu của loại đơn (nút Xuất file ở trang chi tiết đơn, khung Mẫu xuất file). Cần đăng nhập.
      PUT (multipart/form-data: trường EXPORT_TEMPLATE_FIELDS.changes là SaveExportTemplatesRequest dạng chuỗi JSON,
      mỗi file mới một trường tên bằng id tạm) → ExportTemplatesResponse: lưu các thay đổi (xóa, đổi tên, thêm) trong một lần;
      sai một chỗ (mẫu không còn, file không phải .docx đọc được, thiếu file) thì không lưu gì.
      Cần quyền manageFormTypes; loại đơn không có thì 404 */
  templates: '/form-types/:formTypeId/export-templates',
  /** GET → file .docx: mẫu gốc còn nguyên các mã (nút Xem mẫu). Cần quyền manageFormTypes */
  templateFile: '/form-types/:formTypeId/export-templates/:templateId/file',
  /** POST ExportDraftRequest → ExportTemplateCheck: kiểm tra mã trong mẫu theo bản soạn hiện tại của loại đơn
      (chưa lưu cũng được). Cần quyền manageFormTypes */
  templateCheck: '/form-types/:formTypeId/export-templates/:templateId/check',
  /** POST (multipart/form-data: file ở trường EXPORT_TEMPLATE_FIELDS.file, ExportDraftRequest dạng chuỗi JSON ở trường
      EXPORT_TEMPLATE_FIELDS.draft) → ExportTemplateCheck: như templateCheck nhưng với file mẫu chưa lưu (gửi kèm, không lưu lại).
      Cần quyền manageFormTypes */
  fileCheck: '/export-templates/check',
  /** POST ExportFormRequest → file .docx: điền dữ liệu của lá đơn vào một mẫu của loại đơn đó (nút Xuất file).
      Xem được đơn thì xuất được (người nộp đơn, hoặc cán bộ có quyền viewAll); không có đơn / không được xem thì 404 */
  formExport: '/forms/:code/export',
} as const;

/**
 * Đường dẫn API các mẫu của một loại đơn.
 * @param formTypeId  mã loại đơn, vd 'xmm'
 * @returns           vd '/form-types/xmm/export-templates'
 */
export function exportTemplatesPath(formTypeId: string): string {
  return EXPORT_ENDPOINTS.templates.replace(':formTypeId', encodeURIComponent(formTypeId));
}

/**
 * Đường dẫn API các lệnh với một mẫu đã lưu.
 * @param formTypeId  mã loại đơn
 * @param templateId  id mẫu
 * @param action      'file': mẫu gốc · 'check': kiểm tra mã
 * @returns           vd '/form-types/xmm/export-templates/tpl-1/check'
 */
export function exportTemplatePath(formTypeId: string, templateId: string, action: 'file' | 'check'): string {
  return `${exportTemplatesPath(formTypeId)}/${encodeURIComponent(templateId)}/${action}`;
}

/**
 * Đường dẫn API xuất file một lá đơn.
 * @param code  mã đơn
 * @returns     vd '/forms/XMM-2026-001-00001/export'
 */
export function formExportPath(code: string): string {
  return EXPORT_ENDPOINTS.formExport.replace(':code', encodeURIComponent(code));
}

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Các trường của body multipart: changes (lưu các mẫu), file và draft (kiểm tra mã mẫu chưa lưu). */
export const EXPORT_TEMPLATE_FIELDS = { changes: 'changes', file: 'file', draft: 'draft' } as const;

/** Kiểu nội dung của file Word .docx. */
export const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Một mẫu xuất file của loại đơn. */
export const ExportTemplateSchema = z.object({
  id: z.string(),
  /** Tên mẫu, hiện khi chọn mẫu lúc Xuất file; mặc định là tên file bỏ đuôi */
  name: z.string(),
  /** Tên file lúc tải lên, vd 'mau-don.docx' */
  fileName: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  /** Lúc tải lên, giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
  uploadedAt: z.string(),
  /** Họ tên cán bộ tải lên */
  uploadedBy: z.string(),
});
export type ExportTemplate = z.infer<typeof ExportTemplateSchema>;

/** Trả về từ GET /form-types/:formTypeId/export-templates, theo thứ tự tải lên. */
export const ExportTemplatesResponseSchema = z.object({ templates: z.array(ExportTemplateSchema) });
export type ExportTemplatesResponse = z.infer<typeof ExportTemplatesResponseSchema>;

/** Tên mẫu: không để trống. */
const TemplateNameSchema = z.string().trim().min(1, 'Nhập tên mẫu.');

/** Phần chữ của PUT /form-types/:formTypeId/export-templates (trường EXPORT_TEMPLATE_FIELDS.changes, dạng chuỗi JSON).
    Máy chủ làm theo thứ tự: xóa, đổi tên, thêm. */
export const SaveExportTemplatesRequestSchema = z.object({
  /** Id các mẫu đã lưu cần xóa */
  removed: z.array(z.string().min(1)),
  /** Mẫu đã lưu cần đổi tên */
  renamed: z.array(z.object({ templateId: z.string().min(1), name: TemplateNameSchema })),
  /** Mẫu mới: nội dung file ở trường multipart tên bằng tempId; tên file lấy theo file gửi kèm */
  added: z.array(z.object({ tempId: z.string().min(1), name: TemplateNameSchema })),
});
export type SaveExportTemplatesRequest = z.infer<typeof SaveExportTemplatesRequestSchema>;

/** Bản soạn hiện tại của loại đơn (chưa lưu cũng được), để kiểm tra mẫu, lấy ví dụ đúng với câu hỏi đang soạn.
    Bản đang soạn có thể chưa hợp lệ (lựa chọn trống, cột chưa có tên…), nên chỉ kiểm tra mỗi phần có danh sách câu hỏi;
    mã lấy theo nội dung câu hỏi, tên cột như lúc lưu. */
export const ExportDraftRequestSchema = z.object({
  name: z.string(),
  prefix: z.string(),
  sections: z.array(z.custom<FormSection>((section) => typeof section === 'object' && section !== null && Array.isArray((section as FormSection).questions))),
});
export type ExportDraftRequest = z.infer<typeof ExportDraftRequestSchema>;

/** Kết quả Kiểm tra mã của một mẫu. */
export const ExportTemplateCheckSchema = z.object({
  /** Mọi mã có trong mẫu */
  found: z.array(z.string()),
  /** Mã không có trong loại đơn (khi xuất sẽ để trống) */
  unknown: z.array(z.string()),
  /** Mã cột đặt ngoài vòng lặp {#bảng} … {/bảng} (khi xuất sẽ để trống) */
  outside: z.array(z.string()),
  /** Lỗi cú pháp của mẫu (ngoặc, vòng lặp không khớp); "" = không lỗi */
  error: z.string(),
});
export type ExportTemplateCheck = z.infer<typeof ExportTemplateCheckSchema>;

/** Body của POST /forms/:code/export. */
export const ExportFormRequestSchema = z.object({ templateId: z.string().min(1) });
export type ExportFormRequest = z.infer<typeof ExportFormRequestSchema>;

/* ---------- Câu thông báo ---------- */

export const EXPORT_MESSAGES = {
  /** Gọi API khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
  /** Quản lí mẫu khi không có quyền manageFormTypes (403) */
  403: 'Bạn không có quyền quản lí mẫu xuất file.',
  /** Loại đơn không có (404) */
  formTypeNotFound: 'Loại đơn này không còn. Có thể ai đó vừa xóa.',
  /** Mẫu không có (404) */
  templateNotFound: 'Mẫu xuất file này không còn. Có thể ai đó vừa xóa.',
  /** Xuất file đơn không có, hoặc không được xem (404) */
  formNotFound: 'Không có đơn này, hoặc bạn không có quyền xem.',
  /** Tải lên file không phải .docx (422) */
  notDocx: 'Mẫu xuất file phải là file Word .docx (Word 2007 trở lên). File .doc cũ hãy mở bằng Word và lưu lại thành .docx.',
  /** File .docx không đọc được (422) */
  unreadable: 'Không đọc được file này. Hãy chắc đây là file Word .docx.',
  /** Body sai định dạng (422) */
  invalidRequest: 'Dữ liệu không hợp lệ.',
  /** Điền mẫu lỗi (mẫu sai cú pháp) (422), kèm lí do */
  renderFailed: (reason: string) => `Không tạo được file: ${reason}`,
  /** Lưu các mẫu thiếu file của một mẫu mới (422) */
  fileMissing: (name: string) => `Thiếu nội dung file của mẫu “${name}”. Hãy gỡ mẫu đó rồi chọn lại file.`,
  /** Chọn lại file trùng tên với mẫu mới đang chờ lưu (báo ngay, không thêm) */
  duplicateFile: (fileName: string) => `File “${fileName}” đã có trong danh sách chờ lưu.`,
  /** Chỉ lưu các mẫu (không đổi loại đơn) xong (toast) */
  saved: 'Đã lưu các mẫu xuất file.',
  /** Đã lưu loại đơn nhưng lưu mẫu lỗi (toast), kèm lí do; các thay đổi về mẫu vẫn giữ để bấm Lưu lại */
  notSaved: (reason: string) => `Chưa lưu được các mẫu xuất file: ${reason} Bấm Lưu để thử lại.`,
} as const;
