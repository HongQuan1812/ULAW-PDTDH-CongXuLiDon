/* API giả: loại đơn (danh sách cho trang Quản lí loại đơn, loại đơn đang mở, phiên bản đang mở của một loại đơn)
   và các phiên bản (xem, tạo loại đơn, thêm phiên bản, lưu phiên bản Nháp, mở / đóng, xóa phiên bản Nháp). */
import { delay, http, HttpResponse } from 'msw';
import {
  ENDPOINTS,
  FORM_TYPE_DRAFT_MESSAGES,
  FORM_TYPE_MESSAGES,
  SaveFormTypeVersionRequestSchema,
  SetFormTypeVersionStatusRequestSchema,
  can,
  issueMessages,
  validateFormTypeDraft,
  type FormType,
  type FormTypesResponse,
  type ManagedFormType,
  type OpenFormTypesResponse,
  type SaveFormTypeVersionRequest,
  type Session,
} from '@ulaw/shared';
import {
  addFormTypeVersion,
  createFormType,
  deleteFormTypeVersion,
  getFormType,
  getFormTypeSummaries,
  getManagedFormType,
  getOpenFormTypes,
  otherFormTypePrefixes,
  readSession,
  saveFormTypeVersion,
  setFormTypeVersionStatus,
  type FormTypeChange,
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
 * Đọc và kiểm tra bản soạn gửi lên như trình soạn: sai dạng thì 422, bản soạn chưa hợp lệ thì 422 kèm các câu báo,
 * mã đơn trùng loại đơn khác thì 409.
 * @param request           request gửi lên
 * @param exceptFormTypeId  loại đơn đang lưu (không tính khi xét trùng mã đơn); tạo mới thì null
 * @returns                 bản soạn đã đọc (mô tả trống thành null), hoặc response lỗi
 */
async function readSaveRequest(request: Request, exceptFormTypeId: string | null): Promise<SaveFormTypeVersionRequest | Response> {
  // Đúng dạng
  const parsed = SaveFormTypeVersionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(422, FORM_TYPE_MESSAGES.invalidRequest);

  // Kiểm tra như trình soạn; mã đơn trùng thì 409, lỗi khác thì 422
  const issues = validateFormTypeDraft(parsed.data, otherFormTypePrefixes(exceptFormTypeId));
  const prefixTaken = FORM_TYPE_DRAFT_MESSAGES.prefixTaken(parsed.data.prefix);
  if (issues.some((issue) => issue.message === prefixTaken)) return apiError(409, prefixTaken);
  if (issues.length) return apiError(422, issueMessages(issues).join(' '));
  return { ...parsed.data, description: parsed.data.description || null };
}

/**
 * Trả kết quả một lệnh sửa loại đơn.
 * @param change         kết quả từ API giả
 * @param successStatus  mã HTTP khi thành công (200, hoặc 201 khi thêm phiên bản)
 * @returns              loại đơn sau khi sửa, hoặc lỗi
 */
function changeResponse(change: FormTypeChange, successStatus = 200): Response {
  if (!change.ok) return apiError(change.status, change.message);
  return HttpResponse.json<ManagedFormType>(change.formType, { status: successStatus });
}

export const formTypeHandlers = [
  // Mọi loại đơn, cho trang Quản lí loại đơn
  http.get(api(ENDPOINTS.formTypes.list), async () => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    return HttpResponse.json<FormTypesResponse>({ formTypes: getFormTypeSummaries() });
  }),

  // Tạo loại đơn với phiên bản 1
  http.post(api(ENDPOINTS.formTypes.create), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    const input = await readSaveRequest(request, null);
    if (input instanceof Response) return input;
    return HttpResponse.json<ManagedFormType>(createFormType(input, session.user.id), { status: 201 });
  }),

  // Các loại đơn đang nhận đơn
  http.get(api(ENDPOINTS.formTypes.open), async () => {
    await delay(MOCK_DELAY_MS);
    if (!readSession()) return apiError(401, FORM_TYPE_MESSAGES[401]);
    return HttpResponse.json<OpenFormTypesResponse>({ formTypes: getOpenFormTypes() });
  }),

  // Phiên bản đang mở của một loại đơn, để nộp đơn
  http.get(api(ENDPOINTS.formTypes.detail), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    if (!readSession()) return apiError(401, FORM_TYPE_MESSAGES[401]);
    const formType = getFormType(String(params.formTypeId));
    if (!formType) return apiError(404, FORM_TYPE_MESSAGES[404]);
    return HttpResponse.json<FormType>(formType);
  }),

  // Loại đơn kèm mọi phiên bản, cho trình soạn
  http.get(api(ENDPOINTS.formTypes.versions), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    const formType = getManagedFormType(String(params.formTypeId));
    if (!formType) return apiError(404, FORM_TYPE_MESSAGES.notFound);
    return HttpResponse.json<ManagedFormType>(formType);
  }),

  // Thêm phiên bản mới: không được khi đang có phiên bản Nháp
  http.post(api(ENDPOINTS.formTypes.versions), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    const formTypeId = String(params.formTypeId);
    const input = await readSaveRequest(request, formTypeId);
    if (input instanceof Response) return input;
    return changeResponse(addFormTypeVersion(formTypeId, input, session.user.id), 201);
  }),

  // Lưu phiên bản Nháp: phiên bản đã khóa thì không sửa được
  http.put(api(ENDPOINTS.formTypes.version), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    const formTypeId = String(params.formTypeId);
    const input = await readSaveRequest(request, formTypeId);
    if (input instanceof Response) return input;
    return changeResponse(saveFormTypeVersion(formTypeId, Number(params.version), input, session.user.id));
  }),

  // Xóa phiên bản Nháp; phiên bản duy nhất thì xóa luôn loại đơn (204)
  http.delete(api(ENDPOINTS.formTypes.version), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    const result = deleteFormTypeVersion(String(params.formTypeId), Number(params.version));
    if (!result.ok) return apiError(result.status, result.message);
    if (!result.formType) return new HttpResponse(null, { status: 204 });
    return HttpResponse.json<ManagedFormType>(result.formType);
  }),

  // Mở / đóng phiên bản đã khóa
  http.put(api(ENDPOINTS.formTypes.versionStatus), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const session = requireManager();
    if (session instanceof Response) return session;
    const parsed = SetFormTypeVersionStatusRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, FORM_TYPE_MESSAGES.invalidRequest);
    return changeResponse(setFormTypeVersionStatus(String(params.formTypeId), Number(params.version), parsed.data.status, session.user.id));
  }),
];
