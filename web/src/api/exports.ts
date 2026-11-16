/* Hook gọi API xuất file theo mẫu: mẫu của loại đơn (danh sách, lưu các thay đổi, xem mẫu gốc,
   kiểm tra mã kể cả với file chưa lưu), xuất file một lá đơn (Word) và xuất file thống kê (Excel). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EXPORT_MESSAGES,
  EXPORT_TEMPLATE_FIELDS,
  ENDPOINTS,
  exportTemplatePath,
  exportTemplatesPath,
  formExportCheckPath,
  formExportPath,
  type ExportDraftRequest,
  type ExportFormRequest,
  type ExportStatsRequest,
  type ExportTemplateCheck,
  type ExportTemplatesResponse,
  type SaveExportTemplatesRequest,
} from '@ulaw/shared';
import { ApiError, apiFetch, fetchFile, type DownloadedFile } from './client';

/**
 * Khóa lưu tạm danh sách mẫu của một loại đơn.
 * @param formTypeId  mã loại đơn
 * @returns           vd ['exportTemplates', 'xmm']
 */
const exportTemplatesKey = (formTypeId: string) => ['exportTemplates', formTypeId] as const;

/**
 * Các mẫu xuất file của một loại đơn.
 * @param formTypeId  mã loại đơn
 * @param enabled     false thì chưa tải (vd loại đơn mới chưa lưu)
 * @returns           kết quả useQuery; data = các mẫu, theo thứ tự tải lên
 */
export function useExportTemplates(formTypeId: string, enabled = true) {
  return useQuery({
    queryKey: exportTemplatesKey(formTypeId),
    queryFn: () => apiFetch<ExportTemplatesResponse>(exportTemplatesPath(formTypeId)),
    select: (response) => response.templates,
    enabled,
  });
}

/**
 * Lưu các thay đổi về mẫu của một loại đơn (xóa, đổi tên, thêm) cùng các file mới trong một lần. Xong thì danh sách mẫu tải lại.
 * @returns  kết quả useMutation; gọi mutateAsync({ formTypeId, changes, filesByTempId }) → các mẫu sau khi lưu
 */
export function useSaveExportTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ formTypeId, changes, filesByTempId }: { formTypeId: string; changes: SaveExportTemplatesRequest; filesByTempId: ReadonlyMap<string, File> }) => {
      const body = new FormData();
      body.append(EXPORT_TEMPLATE_FIELDS.changes, JSON.stringify(changes));
      filesByTempId.forEach((file, tempId) => body.append(tempId, file, file.name));
      const response = await apiFetch<ExportTemplatesResponse>(exportTemplatesPath(formTypeId), { method: 'PUT', body });
      return response.templates;
    },
    onSuccess: (templates, { formTypeId }) => {
      queryClient.setQueryData<ExportTemplatesResponse>(exportTemplatesKey(formTypeId), { templates });
      return queryClient.invalidateQueries({ queryKey: exportTemplatesKey(formTypeId) });
    },
  });
}

/**
 * Kiểm tra mã trong file mẫu chưa lưu theo bản soạn hiện tại (gửi kèm file, máy chủ không lưu lại).
 * @param file   file mẫu (.docx) đang giữ trong trình duyệt
 * @param draft  tên, mã đơn, các phần đang soạn
 * @returns      kết quả kiểm tra
 */
export function checkExportTemplateFile(file: File, draft: ExportDraftRequest): Promise<ExportTemplateCheck> {
  const body = new FormData();
  body.append(EXPORT_TEMPLATE_FIELDS.file, file, file.name);
  body.append(EXPORT_TEMPLATE_FIELDS.draft, JSON.stringify(draft));
  return apiFetch<ExportTemplateCheck>(ENDPOINTS.exports.fileCheck, { method: 'POST', body });
}

/**
 * Tải mẫu gốc (còn nguyên các mã) để xem.
 * @param formTypeId  mã loại đơn
 * @param templateId  id mẫu
 * @returns           file Word / Excel
 */
export function fetchExportTemplateFile(formTypeId: string, templateId: string): Promise<DownloadedFile> {
  return fetchFile(exportTemplatePath(formTypeId, templateId, 'file'));
}

/**
 * Kiểm tra mã trong một mẫu theo bản soạn hiện tại.
 * @param formTypeId  mã loại đơn
 * @param templateId  id mẫu
 * @param draft       tên, mã đơn, các phần đang soạn
 * @returns           kết quả kiểm tra
 */
export function checkExportTemplate(formTypeId: string, templateId: string, draft: ExportDraftRequest): Promise<ExportTemplateCheck> {
  return apiFetch<ExportTemplateCheck>(exportTemplatePath(formTypeId, templateId, 'check'), { method: 'POST', body: JSON.stringify(draft) });
}

/**
 * So mã trong một mẫu xuất file đơn với các câu hỏi của lá đơn (bản chụp lúc nộp).
 * @param code     mã đơn
 * @param request  mẫu cần kiểm tra
 * @returns        kết quả kiểm tra
 */
export function checkFormExport(code: string, request: ExportFormRequest): Promise<ExportTemplateCheck> {
  return apiFetch<ExportTemplateCheck>(formExportCheckPath(code), { method: 'POST', body: JSON.stringify(request) });
}

/**
 * Xuất file một lá đơn theo một mẫu.
 * @param code     mã đơn
 * @param request  mẫu dùng để điền
 * @returns        file Word đã điền; lỗi thì ném ApiError (câu báo theo EXPORT_MESSAGES)
 */
export function exportForm(code: string, request: ExportFormRequest): Promise<DownloadedFile> {
  return fetchFile(formExportPath(code), { method: 'POST', body: JSON.stringify(request) }).catch(toExportError);
}

/**
 * Xuất file thống kê các lá đơn của loại đơn theo một mẫu thống kê.
 * @param formTypeId  mã loại đơn
 * @param templateId  id mẫu thống kê
 * @param request     phiên bản (số hoặc 'all': mỗi phiên bản một sheet) và khoảng ngày nộp
 * @returns           file Excel đã điền; lỗi thì ném ApiError (câu báo theo EXPORT_MESSAGES)
 */
export function exportStats(formTypeId: string, templateId: string, request: ExportStatsRequest): Promise<DownloadedFile> {
  return fetchFile(exportTemplatePath(formTypeId, templateId, 'export'), { method: 'POST', body: JSON.stringify(request) }).catch(toExportError);
}

/**
 * Lỗi khi xuất file: lỗi của máy chủ giữ nguyên; mất mạng thì đổi thành câu dễ hiểu.
 * @param error  lỗi bắt được
 * @returns      không trả về, luôn ném ApiError
 */
function toExportError(error: unknown): never {
  throw error instanceof ApiError ? error : new ApiError(0, EXPORT_MESSAGES.renderFailed('kiểm tra kết nối mạng rồi thử lại.'));
}
