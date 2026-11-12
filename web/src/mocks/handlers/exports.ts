/* API giả: mẫu xuất file Word của loại đơn (danh sách, lưu các thay đổi, xem mẫu gốc, kiểm tra mã
   kể cả với file chưa lưu, dữ liệu ví dụ) và xuất file một lá đơn. Điền mẫu bằng docxtemplater như máy chủ thật. */
import { delay, http, HttpResponse } from 'msw';
import {
  DOCX_CONTENT_TYPE,
  ENDPOINTS,
  EXPORT_MESSAGES,
  EXPORT_TEMPLATE_FIELDS,
  ExportDraftRequestSchema,
  ExportFormRequestSchema,
  SaveExportTemplatesRequestSchema,
  buildExportData,
  can,
  textToTag,
  type ExportDraftRequest,
  type ExportTemplateCheck,
  type ExportTemplatesResponse,
  type Session,
} from '@ulaw/shared';
import {
  addExportTemplate,
  deleteExportTemplate,
  findExportTemplate,
  formTypeExists,
  getExportSource,
  getExportTemplates,
  readSession,
  renameExportTemplate,
  vietnamToday,
} from '../db';
import { checkDocxTemplate, explainDocxError, openDocx, renderDocxTemplate } from '../docxTemplates';
import { MOCK_DELAY_MS, api, apiError } from '../http';

/**
 * Kiểm tra người đang đăng nhập được quản lí mẫu của loại đơn này không.
 * @param formTypeId  mã loại đơn (từ đường dẫn)
 * @returns           session: phiên đăng nhập · errorResponse: chưa đăng nhập (401), không có quyền (403), không có loại đơn (404)
 */
function templateManager(formTypeId: string): { session: Session; errorResponse?: undefined } | { session?: undefined; errorResponse: Response } {
  const session = readSession();
  if (!session) return { errorResponse: apiError(401, EXPORT_MESSAGES[401]) };
  if (!can(session.role, 'manageFormTypes')) return { errorResponse: apiError(403, EXPORT_MESSAGES[403]) };
  if (!formTypeExists(formTypeId)) return { errorResponse: apiError(404, EXPORT_MESSAGES.formTypeNotFound) };
  return { session };
}

/**
 * Trả nội dung file Word.
 * @param bytes     nội dung
 * @param fileName  tên file khi tải về
 * @returns         câu trả HTTP
 */
function docxResponse(bytes: ArrayBuffer, fileName: string): Response {
  return new HttpResponse(bytes, {
    headers: {
      'Content-Type': DOCX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

/**
 * Tên file xuất ra, không dấu (một số trình duyệt đổi tên file có dấu thành "download").
 * @param prefix        phần đầu, vd mã đơn
 * @param templateName  tên mẫu
 * @returns             vd 'XMM-2026-001-00001_don-gui-phong-dao-tao.docx'
 */
function exportFileName(prefix: string, templateName: string): string {
  return `${prefix}_${textToTag(templateName).replace(/_/g, '-')}.docx`;
}

/**
 * Đọc body JSON theo schema.
 * @param request  yêu cầu
 * @param schema   schema của body
 * @returns        dữ liệu đã kiểm tra; sai thì null
 */
async function readBody<Output>(request: Request, schema: { safeParse: (input: unknown) => { success: boolean; data?: Output } }): Promise<Output | null> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  return parsed.success ? (parsed.data as Output) : null;
}

/**
 * Đọc chuỗi JSON trong một trường multipart.
 * @param field  giá trị của trường
 * @returns      dữ liệu đã đọc; không phải chuỗi JSON hợp lệ thì null
 */
function parseJsonField(field: FormDataEntryValue | null | undefined): unknown {
  if (typeof field !== 'string') return null;
  try {
    return JSON.parse(field);
  } catch {
    return null;
  }
}

/**
 * Đọc yêu cầu kiểm tra mã file mẫu chưa lưu: quyền, file .docx đọc được, bản soạn.
 * @param request  yêu cầu multipart
 * @returns        upload: nội dung file, bản soạn · errorResponse: 401, 403, 422
 */
async function readDraftFile(
  request: Request,
): Promise<{ upload: { bytes: ArrayBuffer; draft: ExportDraftRequest }; errorResponse?: undefined } | { upload?: undefined; errorResponse: Response }> {
  // Quyền quản lí mẫu
  const session = readSession();
  if (!session) return { errorResponse: apiError(401, EXPORT_MESSAGES[401]) };
  if (!can(session.role, 'manageFormTypes')) return { errorResponse: apiError(403, EXPORT_MESSAGES[403]) };

  // Bản soạn và file
  const formData = await request.formData().catch(() => null);
  const parsed = ExportDraftRequestSchema.safeParse(parseJsonField(formData?.get(EXPORT_TEMPLATE_FIELDS.draft)));
  const file = formData?.get(EXPORT_TEMPLATE_FIELDS.file);
  if (!parsed.success || !(file instanceof File)) return { errorResponse: apiError(422, EXPORT_MESSAGES.invalidRequest) };
  if (!/\.docx$/i.test(file.name)) return { errorResponse: apiError(422, EXPORT_MESSAGES.notDocx) };
  const bytes = await file.arrayBuffer();
  if (!openDocx(bytes)) return { errorResponse: apiError(422, EXPORT_MESSAGES.unreadable) };
  return { upload: { bytes, draft: parsed.data } };
}

export const exportHandlers = [
  // Các mẫu của loại đơn: ai đăng nhập cũng xem được (nút Xuất file ở trang chi tiết đơn)
  http.get(api(ENDPOINTS.exports.templates), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    if (!readSession()) return apiError(401, EXPORT_MESSAGES[401]);
    return HttpResponse.json<ExportTemplatesResponse>({ templates: getExportTemplates(String(params.formTypeId)) });
  }),

  // Lưu các thay đổi về mẫu (xóa, đổi tên, thêm) trong một lần: kiểm tra hết trước, sai một chỗ thì không lưu gì
  http.put(api(ENDPOINTS.exports.templates), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const formTypeId = String(params.formTypeId);
    const { session, errorResponse } = templateManager(formTypeId);
    if (!session) return errorResponse;

    // Phần chữ sai định dạng thì 422
    const formData = await request.formData().catch(() => null);
    const parsed = SaveExportTemplatesRequestSchema.safeParse(parseJsonField(formData?.get(EXPORT_TEMPLATE_FIELDS.changes)));
    if (!formData || !parsed.success) return apiError(422, EXPORT_MESSAGES.invalidRequest);
    const changes = parsed.data;

    // Mẫu cần xóa / đổi tên phải còn
    const savedIds = new Set(getExportTemplates(formTypeId).map((template) => template.id));
    if ([...changes.removed, ...changes.renamed.map((rename) => rename.templateId)].some((templateId) => !savedIds.has(templateId))) {
      return apiError(404, EXPORT_MESSAGES.templateNotFound);
    }

    // Mỗi mẫu mới phải có file .docx đọc được
    const uploads: { name: string; fileName: string; bytes: ArrayBuffer }[] = [];
    for (const added of changes.added) {
      const file = formData.get(added.tempId);
      if (!(file instanceof File)) return apiError(422, EXPORT_MESSAGES.fileMissing(added.name));
      if (!/\.docx$/i.test(file.name)) return apiError(422, EXPORT_MESSAGES.notDocx);
      const bytes = await file.arrayBuffer();
      if (!openDocx(bytes)) return apiError(422, `${file.name}: ${EXPORT_MESSAGES.unreadable}`);
      uploads.push({ name: added.name.trim(), fileName: file.name, bytes });
    }

    // Lưu theo thứ tự: xóa, đổi tên, thêm
    changes.removed.forEach((templateId) => deleteExportTemplate(formTypeId, templateId));
    changes.renamed.forEach(({ templateId, name }) => renameExportTemplate(formTypeId, templateId, name.trim()));
    uploads.forEach((upload) => addExportTemplate(formTypeId, upload, session.user.id));
    return HttpResponse.json<ExportTemplatesResponse>({ templates: getExportTemplates(formTypeId) });
  }),

  // Mẫu gốc còn nguyên các mã (nút Xem mẫu)
  http.get(api(ENDPOINTS.exports.templateFile), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const formTypeId = String(params.formTypeId);
    const { session, errorResponse } = templateManager(formTypeId);
    if (!session) return errorResponse;
    const stored = findExportTemplate(formTypeId, String(params.templateId));
    if (!stored) return apiError(404, EXPORT_MESSAGES.templateNotFound);
    return docxResponse(stored.bytes, stored.template.fileName);
  }),

  // Kiểm tra mã trong mẫu theo bản soạn hiện tại
  http.post(api(ENDPOINTS.exports.templateCheck), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const formTypeId = String(params.formTypeId);
    const { session, errorResponse } = templateManager(formTypeId);
    if (!session) return errorResponse;
    const draft = await readBody(request, ExportDraftRequestSchema);
    if (!draft) return apiError(422, EXPORT_MESSAGES.invalidRequest);
    const stored = findExportTemplate(formTypeId, String(params.templateId));
    if (!stored) return apiError(404, EXPORT_MESSAGES.templateNotFound);
    return HttpResponse.json<ExportTemplateCheck>(checkDocxTemplate(stored.bytes, draft.sections));
  }),

  // Kiểm tra mã trong file mẫu chưa lưu (gửi kèm, không lưu lại)
  http.post(api(ENDPOINTS.exports.fileCheck), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const { upload, errorResponse } = await readDraftFile(request);
    if (!upload) return errorResponse;
    return HttpResponse.json<ExportTemplateCheck>(checkDocxTemplate(upload.bytes, upload.draft.sections));
  }),

  // Xuất file một lá đơn: xem được đơn thì xuất được
  http.post(api(ENDPOINTS.exports.formExport), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, EXPORT_MESSAGES[401]);
    const body = await readBody(request, ExportFormRequestSchema);
    if (!body) return apiError(422, EXPORT_MESSAGES.invalidRequest);

    // Không có đơn, hoặc không phải đơn của mình mà không được xem mọi đơn: 404
    const code = String(params.code);
    const exportable = getExportSource(code, { id: session.user.id, role: session.role });
    if (!exportable) return apiError(404, EXPORT_MESSAGES.formNotFound);

    // Mẫu phải thuộc loại đơn của đơn này
    const stored = findExportTemplate(exportable.formTypeId, body.templateId);
    if (!stored) return apiError(404, EXPORT_MESSAGES.templateNotFound);

    try {
      const filled = renderDocxTemplate(stored.bytes, buildExportData(exportable.source, vietnamToday()));
      return docxResponse(filled, exportFileName(code, stored.template.name));
    } catch (docxError) {
      return apiError(422, EXPORT_MESSAGES.renderFailed(explainDocxError(docxError)));
    }
  }),
];
