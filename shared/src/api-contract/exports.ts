/* HỢP ĐỒNG nhóm API xuất file theo mẫu: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này.

   Mỗi loại đơn có hai nhóm mẫu, lưu ở máy chủ theo loại đơn (dùng chung mọi phiên bản), cùng một bộ mã trường trong
   ngoặc nhọn (xem business-rules/exports--tags.ts):
   - Mẫu xuất file đơn (purpose 'form'): file Word .docx, điền dữ liệu của MỘT lá đơn (nút Xuất file ở chi tiết đơn).
   - Mẫu xuất file thống kê (purpose 'stats'): file Excel .xlsx, điền MỌI lá đơn của loại đơn, mỗi đơn một hàng
     (xem business-rules/exports--xlsx.ts).
   Cán bộ quản lí mẫu ở trình soạn loại đơn:
   thêm, đổi tên, xóa mẫu chỉ ghi nhận trong trình duyệt; bấm Lưu thì gửi mọi thay đổi cùng các file mới trong MỘT lần
   (như nộp đơn kèm tệp). Mẫu chưa lưu vẫn kiểm tra mã được bằng cách gửi kèm file.
   Máy chủ điền mẫu (Word: docxtemplater · Excel: ExcelJS) và trả file; định dạng của mẫu (font, bảng, căn lề) giữ nguyên.
   Các lệnh trả file (xem mẫu gốc, xuất file) trả nội dung .docx / .xlsx, không phải JSON;
   tên file trong Content-Disposition. */
import { z } from 'zod';
import type { FormSection } from '../aux-schema/form-types--sections';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const EXPORT_ENDPOINTS = {
  /** GET → ExportTemplatesResponse: các mẫu của loại đơn (nút Xuất file ở trang chi tiết đơn, khung Mẫu xuất file). Cần đăng nhập.
      PUT (multipart/form-data: trường EXPORT_TEMPLATE_FIELDS.changes là SaveExportTemplatesRequest dạng chuỗi JSON,
      mỗi file mới một trường tên bằng id tạm) → ExportTemplatesResponse: lưu các thay đổi (xóa, đổi tên, thêm) trong một lần;
      sai một chỗ (mẫu không còn, file không đúng loại của mẫu hoặc không đọc được, thiếu file) thì không lưu gì.
      Cần quyền manageFormTypes; loại đơn không có thì 404 */
  templates: '/form-types/:formTypeId/export-templates',
  /** GET → file .docx / .xlsx: mẫu gốc còn nguyên các mã (nút Xem mẫu). Cần quyền manageFormTypes */
  templateFile: '/form-types/:formTypeId/export-templates/:templateId/file',
  /** POST ExportDraftRequest → ExportTemplateCheck: kiểm tra mã trong mẫu theo bản soạn hiện tại của loại đơn
      (chưa lưu cũng được). Cần quyền manageFormTypes */
  templateCheck: '/form-types/:formTypeId/export-templates/:templateId/check',
  /** POST (multipart/form-data: file ở trường EXPORT_TEMPLATE_FIELDS.file, ExportDraftRequest dạng chuỗi JSON ở trường
      EXPORT_TEMPLATE_FIELDS.draft) → ExportTemplateCheck: như templateCheck nhưng với file mẫu chưa lưu (gửi kèm, không lưu lại);
      file .docx kiểm tra như mẫu đơn, .xlsx như mẫu thống kê. Cần quyền manageFormTypes */
  fileCheck: '/export-templates/check',
  /** POST ExportFormRequest → file .docx: điền dữ liệu của lá đơn vào một mẫu xuất file đơn của loại đơn đó (nút Xuất file).
      Xem được đơn thì xuất được (người nộp đơn, hoặc cán bộ có quyền viewAll); không có đơn / không được xem thì 404 */
  formExport: '/forms/:code/export',
  /** POST ExportFormRequest → ExportTemplateCheck: so mã trong một mẫu xuất file đơn với các câu hỏi của lá đơn này (bản chụp lúc nộp),
      để người xuất file thấy mã nào đơn không có (sẽ để trống) trước khi xuất. Xem được đơn thì kiểm được, như formExport */
  formExportCheck: '/forms/:code/export-check',
  /** POST → file .xlsx: điền mọi lá đơn của loại đơn (mọi phiên bản, mọi trạng thái, theo thứ tự nộp) vào một mẫu
      xuất file thống kê (nút Xuất ở khung Mẫu xuất file thống kê). Cần quyền manageFormTypes; mẫu không phải mẫu thống kê thì 404 */
  statsExport: '/form-types/:formTypeId/export-templates/:templateId/export',
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
 * @param action      'file': mẫu gốc · 'check': kiểm tra mã · 'export': xuất file thống kê
 * @returns           vd '/form-types/xmm/export-templates/tpl-1/check'
 */
export function exportTemplatePath(formTypeId: string, templateId: string, action: 'file' | 'check' | 'export'): string {
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

/**
 * Đường dẫn API kiểm tra mã của mẫu theo một lá đơn.
 * @param code  mã đơn
 * @returns     vd '/forms/XMM-2026-001-00001/export-check'
 */
export function formExportCheckPath(code: string): string {
  return EXPORT_ENDPOINTS.formExportCheck.replace(':code', encodeURIComponent(code));
}

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Các trường của body multipart: changes (lưu các mẫu), file và draft (kiểm tra mã mẫu chưa lưu). */
export const EXPORT_TEMPLATE_FIELDS = { changes: 'changes', file: 'file', draft: 'draft' } as const;

/** Kiểu nội dung của file Word .docx. */
export const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Kiểu nội dung của file Excel .xlsx. */
export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Mẫu dùng để làm gì: 'form' xuất file một lá đơn (Word) · 'stats' xuất file thống kê mọi lá đơn (Excel). */
export const ExportTemplatePurposeSchema = z.enum(['form', 'stats']);
export type ExportTemplatePurpose = z.infer<typeof ExportTemplatePurposeSchema>;

/** Đuôi file, kiểu nội dung, nhãn loại file của mẫu theo mục đích. */
export const EXPORT_TEMPLATE_FILE: Record<ExportTemplatePurpose, { extension: string; contentType: string; typeLabel: string }> = {
  form: { extension: '.docx', contentType: DOCX_CONTENT_TYPE, typeLabel: 'DOCX' },
  stats: { extension: '.xlsx', contentType: XLSX_CONTENT_TYPE, typeLabel: 'XLSX' },
};

/**
 * File có đúng đuôi của mẫu theo mục đích không.
 * @param fileName  tên file
 * @param purpose   mục đích của mẫu
 * @returns         true nếu đuôi đúng (không phân biệt hoa thường)
 */
export function hasTemplateExtension(fileName: string, purpose: ExportTemplatePurpose): boolean {
  return fileName.toLowerCase().endsWith(EXPORT_TEMPLATE_FILE[purpose].extension);
}

/** Một mẫu xuất file của loại đơn. */
export const ExportTemplateSchema = z.object({
  id: z.string(),
  purpose: ExportTemplatePurposeSchema,
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
  added: z.array(z.object({ tempId: z.string().min(1), name: TemplateNameSchema, purpose: ExportTemplatePurposeSchema })),
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
  /** Mẫu Word: mã cột đặt ngoài vòng lặp {#bảng} … {/bảng} (khi xuất sẽ để trống) · mẫu Excel: luôn rỗng */
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
  /** Tải lên mẫu xuất file đơn không phải .docx (422) */
  notDocx: 'Mẫu xuất file đơn phải là file Word .docx (Word 2007 trở lên). File .doc cũ hãy mở bằng Word và lưu lại thành .docx.',
  /** Tải lên mẫu xuất file thống kê không phải .xlsx (422) */
  notXlsx: 'Mẫu xuất file thống kê phải là file Excel .xlsx (Excel 2007 trở lên). File .xls cũ hãy mở bằng Excel và lưu lại thành .xlsx.',
  /** File .docx không đọc được (422) */
  unreadable: 'Không đọc được file này. Hãy chắc đây là file Word .docx.',
  /** File .xlsx không đọc được (422) */
  unreadableXlsx: 'Không đọc được file này. Hãy chắc đây là file Excel .xlsx.',
  /** Kiểm tra mã file chưa lưu không phải .docx hay .xlsx (422) */
  notTemplateFile: 'Mẫu xuất file phải là file Word .docx hoặc Excel .xlsx.',
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

/** Câu báo file mẫu sai loại / không đọc được, theo mục đích của mẫu. */
export const TEMPLATE_FILE_MESSAGES: Record<ExportTemplatePurpose, { wrongType: string; unreadable: string }> = {
  form: { wrongType: EXPORT_MESSAGES.notDocx, unreadable: EXPORT_MESSAGES.unreadable },
  stats: { wrongType: EXPORT_MESSAGES.notXlsx, unreadable: EXPORT_MESSAGES.unreadableXlsx },
};

/**
 * Mục đích của một file mẫu theo đuôi file.
 * @param fileName  tên file
 * @returns         'form' (.docx), 'stats' (.xlsx); đuôi khác thì null
 */
export function templatePurposeOfFile(fileName: string): ExportTemplatePurpose | null {
  if (hasTemplateExtension(fileName, 'form')) return 'form';
  if (hasTemplateExtension(fileName, 'stats')) return 'stats';
  return null;
}
