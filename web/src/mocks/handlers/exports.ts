/* API giả: mẫu xuất file của loại đơn (danh sách, lưu các thay đổi, xem mẫu gốc, kiểm tra mã
   kể cả với file chưa lưu), xuất file một lá đơn (Word, docxtemplater) và xuất file thống kê (Excel, ExcelJS) như máy chủ thật. */
import { delay, http, HttpResponse } from 'msw';
import {
  DOCX_CONTENT_TYPE,
  ENDPOINTS,
  EXPORT_MESSAGES,
  EXPORT_TEMPLATE_FIELDS,
  EXPORT_TEMPLATE_FILE,
  ExportDraftRequestSchema,
  ExportFormRequestSchema,
  FORM_COUNT_TAG,
  SaveExportTemplatesRequestSchema,
  TEMPLATE_FILE_MESSAGES,
  buildExportData,
  can,
  checkDocxTemplate,
  checkXlsxTemplate,
  explainDocxError,
  hasTemplateExtension,
  isReadableTemplateFile,
  renderDocxTemplate,
  renderXlsxByVersion,
  selectStatsForms,
  statsSheetName,
  ExportStatsRequestSchema,
  templatePurposeOfFile,
  textToTag,
  type ExportDraftRequest,
  type ExportTemplateCheck,
  type ExportTemplatePurpose,
  type ExportTemplatesResponse,
  type FormSection,
  type Session,
} from '@ulaw/shared';
import {
  addExportTemplate,
  deleteExportTemplate,
  findExportTemplate,
  formTypeExists,
  getExportSource,
  getExportTemplates,
  getStatsExportSources,
  readSession,
  renameExportTemplate,
  vietnamToday,
} from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

/**
 * Kiểm tra người đang đăng nhập được quản lí mẫu của loại đơn này không.
 * @param formTypeId  mã loại đơn (từ đường dẫn)
 * @returns           session: phiên đăng nhập · errorResponse: chưa đăng nhập (401), không có quyền (403), không có loại đơn (404)
 */
async function templateManager(formTypeId: string): Promise<{ session: Session; errorResponse?: undefined } | { session?: undefined; errorResponse: Response }> {
  const session = await readSession();
  if (!session) return { errorResponse: apiError(401, EXPORT_MESSAGES[401]) };
  if (!can(session.role, 'manageFormTypes')) return { errorResponse: apiError(403, EXPORT_MESSAGES[403]) };
  if (!formTypeExists(formTypeId)) return { errorResponse: apiError(404, EXPORT_MESSAGES.formTypeNotFound) };
  return { session };
}

/**
 * Trả nội dung một file.
 * @param bytes        nội dung
 * @param fileName     tên file khi tải về
 * @param contentType  kiểu nội dung (Word / Excel)
 * @returns            câu trả HTTP
 */
function fileResponse(bytes: ArrayBuffer, fileName: string, contentType: string): Response {
  return new HttpResponse(bytes, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

/**
 * Tên file xuất ra, không dấu (một số trình duyệt đổi tên file có dấu thành "download").
 * @param prefix        phần đầu, vd mã đơn, tiền tố mã đơn
 * @param templateName  tên mẫu
 * @param purpose       quyết định đuôi file
 * @returns             vd 'XMM-2026-001-00001_don-gui-phong-dao-tao.docx'
 */
function exportFileName(prefix: string, templateName: string, purpose: ExportTemplatePurpose): string {
  return `${prefix}_${textToTag(templateName).replace(/_/g, '-')}${EXPORT_TEMPLATE_FILE[purpose].extension}`;
}

/**
 * Kiểm tra mã một mẫu theo mục đích: mẫu đơn theo docxtemplater, mẫu thống kê theo ExcelJS.
 * @param bytes     nội dung file mẫu
 * @param purpose   mục đích của mẫu
 * @param sections  các phần của bản soạn
 * @returns         kết quả kiểm tra
 */
function checkTemplate(bytes: ArrayBuffer, purpose: ExportTemplatePurpose, sections: readonly FormSection[]): Promise<ExportTemplateCheck> {
  return purpose === 'form' ? Promise.resolve(checkDocxTemplate(bytes, sections)) : checkXlsxTemplate(bytes, sections);
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
 * Đọc yêu cầu kiểm tra mã file mẫu chưa lưu: quyền, file .docx / .xlsx đọc được, bản soạn.
 * @param request  yêu cầu multipart
 * @returns        upload: nội dung file, mục đích theo đuôi file, bản soạn · errorResponse: 401, 403, 422
 */
async function readDraftFile(
  request: Request,
): Promise<
  | { upload: { bytes: ArrayBuffer; purpose: ExportTemplatePurpose; draft: ExportDraftRequest }; errorResponse?: undefined }
  | { upload?: undefined; errorResponse: Response }
> {
  // Quyền quản lí mẫu
  const session = await readSession();
  if (!session) return { errorResponse: apiError(401, EXPORT_MESSAGES[401]) };
  if (!can(session.role, 'manageFormTypes')) return { errorResponse: apiError(403, EXPORT_MESSAGES[403]) };

  // Bản soạn và file; mục đích theo đuôi file
  const formData = await request.formData().catch(() => null);
  const parsed = ExportDraftRequestSchema.safeParse(parseJsonField(formData?.get(EXPORT_TEMPLATE_FIELDS.draft)));
  const file = formData?.get(EXPORT_TEMPLATE_FIELDS.file);
  if (!parsed.success || !(file instanceof File)) return { errorResponse: apiError(422, EXPORT_MESSAGES.invalidRequest) };
  const purpose = templatePurposeOfFile(file.name);
  if (!purpose) return { errorResponse: apiError(422, EXPORT_MESSAGES.notTemplateFile) };
  const bytes = await file.arrayBuffer();
  if (!(await isReadableTemplateFile(bytes, purpose))) return { errorResponse: apiError(422, TEMPLATE_FILE_MESSAGES[purpose].unreadable) };
  return { upload: { bytes, purpose, draft: parsed.data } };
}

export const exportHandlers = [
  // Các mẫu của loại đơn: ai đăng nhập cũng xem được (nút Xuất file ở trang chi tiết đơn)
  http.get(api(ENDPOINTS.exports.templates), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    if (!(await readSession())) return apiError(401, EXPORT_MESSAGES[401]);
    return HttpResponse.json<ExportTemplatesResponse>({ templates: getExportTemplates(String(params.formTypeId)) });
  }),

  // Lưu các thay đổi về mẫu (xóa, đổi tên, thêm) trong một lần: kiểm tra hết trước, sai một chỗ thì không lưu gì
  http.put(api(ENDPOINTS.exports.templates), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const formTypeId = String(params.formTypeId);
    const { session, errorResponse } = await templateManager(formTypeId);
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

    // Mỗi mẫu mới phải có file đúng loại (.docx cho mẫu đơn, .xlsx cho mẫu thống kê) và đọc được
    const uploads: { purpose: ExportTemplatePurpose; name: string; fileName: string; bytes: ArrayBuffer }[] = [];
    for (const added of changes.added) {
      const file = formData.get(added.tempId);
      if (!(file instanceof File)) return apiError(422, EXPORT_MESSAGES.fileMissing(added.name));
      const messages = TEMPLATE_FILE_MESSAGES[added.purpose];
      if (!hasTemplateExtension(file.name, added.purpose)) return apiError(422, messages.wrongType);
      const bytes = await file.arrayBuffer();
      if (!(await isReadableTemplateFile(bytes, added.purpose))) return apiError(422, `${file.name}: ${messages.unreadable}`);
      uploads.push({ purpose: added.purpose, name: added.name.trim(), fileName: file.name, bytes });
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
    const { session, errorResponse } = await templateManager(formTypeId);
    if (!session) return errorResponse;
    const stored = findExportTemplate(formTypeId, String(params.templateId));
    if (!stored) return apiError(404, EXPORT_MESSAGES.templateNotFound);
    return fileResponse(stored.bytes, stored.template.fileName, EXPORT_TEMPLATE_FILE[stored.template.purpose].contentType);
  }),

  // Kiểm tra mã trong mẫu theo bản soạn hiện tại
  http.post(api(ENDPOINTS.exports.templateCheck), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const formTypeId = String(params.formTypeId);
    const { session, errorResponse } = await templateManager(formTypeId);
    if (!session) return errorResponse;
    const draft = await readBody(request, ExportDraftRequestSchema);
    if (!draft) return apiError(422, EXPORT_MESSAGES.invalidRequest);
    const stored = findExportTemplate(formTypeId, String(params.templateId));
    if (!stored) return apiError(404, EXPORT_MESSAGES.templateNotFound);
    return HttpResponse.json<ExportTemplateCheck>(await checkTemplate(stored.bytes, stored.template.purpose, draft.sections));
  }),

  // Kiểm tra mã trong file mẫu chưa lưu (gửi kèm, không lưu lại)
  http.post(api(ENDPOINTS.exports.fileCheck), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const { upload, errorResponse } = await readDraftFile(request);
    if (!upload) return errorResponse;
    return HttpResponse.json<ExportTemplateCheck>(await checkTemplate(upload.bytes, upload.purpose, upload.draft.sections));
  }),

  // Xuất file một lá đơn: xem được đơn thì xuất được
  http.post(api(ENDPOINTS.exports.formExport), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, EXPORT_MESSAGES[401]);
    const body = await readBody(request, ExportFormRequestSchema);
    if (!body) return apiError(422, EXPORT_MESSAGES.invalidRequest);

    // Không có đơn, hoặc không phải đơn của mình mà không được xem mọi đơn: 404
    const code = String(params.code);
    const exportable = getExportSource(code, { id: session.user.id, role: session.role });
    if (!exportable) return apiError(404, EXPORT_MESSAGES.formNotFound);

    // Mẫu phải là mẫu xuất file đơn của loại đơn này
    const stored = findExportTemplate(exportable.formTypeId, body.templateId);
    if (!stored || stored.template.purpose !== 'form') return apiError(404, EXPORT_MESSAGES.templateNotFound);

    try {
      const filled = renderDocxTemplate(stored.bytes, buildExportData(exportable.source, vietnamToday()));
      return fileResponse(filled, exportFileName(code, stored.template.name, 'form'), DOCX_CONTENT_TYPE);
    } catch (docxError) {
      return apiError(422, EXPORT_MESSAGES.renderFailed(explainDocxError(docxError)));
    }
  }),

  // Kiểm tra mã của mẫu theo một lá đơn (bản chụp lúc nộp): xem được đơn thì kiểm được
  http.post(api(ENDPOINTS.exports.formExportCheck), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, EXPORT_MESSAGES[401]);
    const body = await readBody(request, ExportFormRequestSchema);
    if (!body) return apiError(422, EXPORT_MESSAGES.invalidRequest);
    const exportable = getExportSource(String(params.code), { id: session.user.id, role: session.role });
    if (!exportable) return apiError(404, EXPORT_MESSAGES.formNotFound);
    const stored = findExportTemplate(exportable.formTypeId, body.templateId);
    if (!stored || stored.template.purpose !== 'form') return apiError(404, EXPORT_MESSAGES.templateNotFound);
    return HttpResponse.json<ExportTemplateCheck>(await checkTemplate(stored.bytes, 'form', exportable.source.sections));
  }),

  // Xuất file thống kê: các lá đơn của loại đơn (cũ trước) theo phiên bản và ngày nộp; mỗi phiên bản một sheet, mỗi đơn một hàng
  http.post(api(ENDPOINTS.exports.statsExport), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const formTypeId = String(params.formTypeId);
    const { session, errorResponse } = await templateManager(formTypeId);
    if (!session) return errorResponse;

    // Mẫu phải là mẫu thống kê của loại đơn này; điều kiện chọn đơn phải đúng dạng
    const stored = findExportTemplate(formTypeId, String(params.templateId));
    if (!stored || stored.template.purpose !== 'stats') return apiError(404, EXPORT_MESSAGES.templateNotFound);
    const parsedFilter = ExportStatsRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsedFilter.success) return apiError(422, EXPORT_MESSAGES.invalidRequest);
    const filter = parsedFilter.data;

    // Phiên bản chọn phải có
    const { forms, versions, prefix } = getStatsExportSources(formTypeId);
    const chosenVersions = filter.version === 'all' ? versions : versions.filter(({ version }) => version === filter.version);
    if (!chosenVersions.length) return apiError(404, EXPORT_MESSAGES.versionNotFound);

    // Mỗi phiên bản một nhóm: dữ liệu từng đơn và mã chung (tên loại đơn là tên của phiên bản đó)
    const exportedOn = vietnamToday();
    const selectedForms = selectStatsForms(forms.map((form) => ({ ...form, submittedAt: form.source.submittedAt })), filter);
    const groups = chosenVersions.map(({ version, name }) => {
      const versionForms = selectedForms.filter((selected) => selected.version === version);
      return {
        sheetName: statsSheetName(version),
        formsData: versionForms.map(({ source }) => buildExportData(source, exportedOn)),
        summaryData: { [FORM_COUNT_TAG]: versionForms.length, loai_don: name, ngay_xuat: exportedOn.split('-').reverse().join('/') },
      };
    });

    try {
      const filled = await renderXlsxByVersion(stored.bytes, groups);
      return fileResponse(filled, exportFileName(prefix, stored.template.name, 'stats'), EXPORT_TEMPLATE_FILE.stats.contentType);
    } catch (xlsxError) {
      return apiError(422, EXPORT_MESSAGES.renderFailed(xlsxError instanceof Error ? xlsxError.message : String(xlsxError)));
    }
  }),
];
