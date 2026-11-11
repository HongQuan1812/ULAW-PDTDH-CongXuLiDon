/* API giả: loại đơn (danh sách cho trang Quản lí loại đơn, loại đơn đang mở, một loại đơn; tạo, lưu, xóa loại đơn). */
import { delay, http, HttpResponse } from 'msw';
import {
  ENDPOINTS,
  FORM_TYPE_DRAFT_MESSAGES,
  FORM_TYPE_MESSAGES,
  SaveFormTypeRequestSchema,
  can,
  canChooseDraftStatus,
  issueMessages,
  validateFormTypeDraft,
  type FormType,
  type FormTypesResponse,
  type OpenFormTypesResponse,
  type SaveFormTypeRequest,
  type Session,
} from '@ulaw/shared';
import {
  countFormsOfType,
  createFormType,
  deleteFormType,
  getFormType,
  getFormTypeSummaries,
  getOpenFormTypes,
  otherFormTypePrefixes,
  readSession,
  updateFormType,
} from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

/**
 * Kiểm tra đăng nhập và quyền quản lí loại đơn.
 * @returns  phiên đăng nhập; không được phép thì response lỗi 401 / 403
 */
function requireManager(): Session | Response {
  const session = readSession();
  if (!session) return apiError(401, FORM_TYPE_MESSAGES[401]);
  if (!can(session.role, 'manageFormTypes')) return apiError(403, FORM_TYPE_MESSAGES[403]);
  return session;
}

/**
 * Đọc và kiểm tra loại đơn gửi lên như trình soạn: sai dạng thì 422, bản soạn chưa hợp lệ thì 422 kèm các câu báo,
 * mã đơn trùng loại đơn khác thì 409.
 * @param request           request gửi lên
 * @param exceptFormTypeId  loại đơn đang lưu (không tính khi xét trùng mã đơn); tạo mới thì null
 * @returns                 loại đơn đã đọc (tên, mô tả bỏ khoảng trắng thừa), hoặc response lỗi
 */
async function readSaveRequest(request: Request, exceptFormTypeId: string | null): Promise<SaveFormTypeRequest | Response> {
  // Đúng dạng
  const parsed = SaveFormTypeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(422, FORM_TYPE_MESSAGES.invalidRequest);

  // Kiểm tra như trình soạn; mã đơn trùng thì 409, lỗi khác thì 422
  const issues = validateFormTypeDraft(parsed.data, otherFormTypePrefixes(exceptFormTypeId));
  if (issues.some((issue) => issue.message === FORM_TYPE_DRAFT_MESSAGES.prefixTaken(parsed.data.prefix))) {
    return apiError(409, FORM_TYPE_DRAFT_MESSAGES.prefixTaken(parsed.data.prefix));
  }
  if (issues.length) return apiError(422, issueMessages(issues).join(' '));
  return { ...parsed.data, description: parsed.data.description || null };
}

export const formTypeHandlers = [
  // Mọi loại đơn, cho trang Quản lí loại đơn: cần quyền manageFormTypes
  http.get(api(ENDPOINTS.formTypes.list), async () => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    return HttpResponse.json<FormTypesResponse>({ formTypes: getFormTypeSummaries() });
  }),

  // Tạo loại đơn
  http.post(api(ENDPOINTS.formTypes.create), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    const input = await readSaveRequest(request, null);
    if (input instanceof Response) return input;
    return HttpResponse.json<FormType>(createFormType(input, session.user.id), { status: 201 });
  }),

  // Lưu loại đơn: đã có đơn thì không đổi được mã đơn; đã phát hành thì không về Nháp được
  http.put(api(ENDPOINTS.formTypes.detail), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    const formTypeId = String(params.formTypeId);
    const savedFormType = getFormType(formTypeId, true);
    if (!savedFormType) return apiError(404, FORM_TYPE_MESSAGES.notFound);
    const input = await readSaveRequest(request, formTypeId);
    if (input instanceof Response) return input;
    if (input.prefix !== savedFormType.prefix && countFormsOfType(formTypeId) > 0) return apiError(409, FORM_TYPE_MESSAGES.prefixLocked);
    if (input.status === 'draft' && !canChooseDraftStatus(savedFormType.status)) return apiError(409, FORM_TYPE_MESSAGES.draftLocked);
    return HttpResponse.json<FormType>(updateFormType(formTypeId, input, session.user.id)!);
  }),

  // Xóa loại đơn: chỉ khi chưa có đơn nào
  http.delete(api(ENDPOINTS.formTypes.detail), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    const formTypeId = String(params.formTypeId);
    if (!getFormType(formTypeId, true)) return apiError(404, FORM_TYPE_MESSAGES.notFound);
    if (countFormsOfType(formTypeId) > 0) return apiError(409, FORM_TYPE_MESSAGES.hasForms);
    deleteFormType(formTypeId);
    return new HttpResponse(null, { status: 204 });
  }),

  // Các loại đơn đang nhận đơn
  http.get(api(ENDPOINTS.formTypes.open), async () => {
    await delay(MOCK_DELAY_MS);
    if (!readSession()) return apiError(401, FORM_TYPE_MESSAGES[401]);
    return HttpResponse.json<OpenFormTypesResponse>({ formTypes: getOpenFormTypes() });
  }),

  // Một loại đơn, đủ cấu trúc: người không quản lí loại đơn chỉ lấy được loại đơn Đang mở
  http.get(api(ENDPOINTS.formTypes.detail), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_TYPE_MESSAGES[401]);
    const formType = getFormType(String(params.formTypeId), can(session.role, 'manageFormTypes'));
    if (!formType) return apiError(404, FORM_TYPE_MESSAGES[404]);
    return HttpResponse.json<FormType>(formType);
  }),
];
