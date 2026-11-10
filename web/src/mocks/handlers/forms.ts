/* API giả: lá đơn (nộp đơn mới, danh sách đơn của mình, đơn phụ trách, chi tiết một đơn, sửa đơn, tiếp nhận). */
import { delay, http, HttpResponse } from 'msw';
import {
  ANSWER_MESSAGES,
  ENDPOINTS,
  FORM_MESSAGES,
  SUBMIT_FORM_FIELDS,
  SubmitFormRequestSchema,
  UpdateFormRequestSchema,
  can,
  canEditForm,
  isEditable,
  isReceivable,
  validateAnswers,
  validateSentFiles,
  type FormDetail,
  type FormSummary,
  type HandledFormsResponse,
  type MyFormsResponse,
} from '@ulaw/shared';
import { addForm, getFormDetail, getFormType, getFormsHandledBy, getFormsOf, getSavedFileIds, readSession, receiveForm, updateForm } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

/**
 * Tách body multipart của POST /forms và PUT /forms/:code: phần chữ (chuỗi JSON) và các tệp theo id tạm.
 * @param request  request nhận được
 * @returns        jsonValue: phần chữ đã đọc (hỏng thì null) · filesByTempId: tệp gửi kèm; body không phải multipart thì null
 */
async function readMultipart(request: Request): Promise<{ jsonValue: unknown; filesByTempId: Map<string, File> } | null> {
  const body = await request.formData().catch(() => null);
  if (!body) return null;
  const requestText = body.get(SUBMIT_FORM_FIELDS.request);
  const filesByTempId = new Map<string, File>();
  body.forEach((part, fieldName) => {
    if (part instanceof File) filesByTempId.set(fieldName, part);
  });
  return { jsonValue: typeof requestText === 'string' ? readJson(requestText) : null, filesByTempId };
}

/**
 * Tên và dung lượng của các tệp gửi kèm, để kiểm tra bằng validateSentFiles.
 * @param filesByTempId  tệp gửi kèm theo id tạm
 * @returns              thông tin tệp theo id tạm
 */
function sentFileInfos(filesByTempId: ReadonlyMap<string, File>) {
  return new Map([...filesByTempId].map(([tempId, file]) => [tempId, { name: file.name, sizeBytes: file.size }]));
}

/**
 * Đọc chuỗi JSON.
 * @param jsonText  chuỗi JSON
 * @returns         dữ liệu đọc được; chuỗi hỏng thì null
 */
function readJson(jsonText: string): unknown {
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

export const formHandlers = [
  // Nộp đơn mới: câu trả lời và mọi tệp đến trong một lần. Kiểm tra hết rồi mới lưu; sai một chỗ thì không lưu gì
  http.post(api(ENDPOINTS.forms.submit), async ({ request }) => {
    await delay(MOCK_DELAY_MS);

    // Chưa đăng nhập thì 401, không được nộp đơn thì 403
    const session = readSession();
    if (!session) return apiError(401, FORM_MESSAGES[401]);
    if (!can(session.role, 'submit')) return apiError(403, FORM_MESSAGES.submitForbidden);

    // Tách body multipart: phần chữ (JSON) và các tệp theo id tạm; sai định dạng thì 422
    const multipart = await readMultipart(request);
    const parsed = SubmitFormRequestSchema.safeParse(multipart?.jsonValue);
    if (!multipart || !parsed.success) return apiError(422, FORM_MESSAGES.invalidBody);
    const { formTypeId, answers, committed } = parsed.data;
    const { filesByTempId } = multipart;

    // Loại đơn không có hoặc không còn nhận đơn thì 404
    const formType = getFormType(formTypeId, false);
    if (!formType) return apiError(404, FORM_MESSAGES.formTypeClosed);

    // Câu trả lời sai, chưa cam đoan, hoặc tệp thiếu / sai định dạng / quá dung lượng / thừa thì 422; câu báo giống trang nộp đơn
    const { invalidSectionTitles } = validateAnswers(formType.sections, answers);
    if (invalidSectionTitles.length) return apiError(422, ANSWER_MESSAGES.sectionsToCheck(invalidSectionTitles));
    if (!committed) return apiError(422, ANSWER_MESSAGES.commitmentRequired);
    const fileError = validateSentFiles(formType.sections, answers, sentFileInfos(filesByTempId));
    if (fileError) return apiError(422, fileError);

    // Đúng hết: lưu đơn và tệp cùng lúc
    return HttpResponse.json<FormSummary>(addForm(session.user.id, formType, answers, filesByTempId), { status: 201 });
  }),

  // Các đơn mình đã nộp
  http.get(api(ENDPOINTS.forms.mine), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_MESSAGES[401]);
    return HttpResponse.json<MyFormsResponse>({ forms: getFormsOf(session.user.id) });
  }),

  // Các đơn mình tiếp nhận hoặc đang xử lí: chỉ vai trò được xử lí đơn (quyền decide)
  http.get(api(ENDPOINTS.forms.handled), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_MESSAGES[401]);
    if (!can(session.role, 'decide')) return apiError(403, FORM_MESSAGES[403]);
    return HttpResponse.json<HandledFormsResponse>({ forms: getFormsHandledBy(session.user.id) });
  }),

  // Một lá đơn đủ nội dung. Đặt sau /forms/mine và /forms/handled để hai đường dẫn đó không bị hiểu là mã đơn
  http.get(api(ENDPOINTS.forms.detail), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_MESSAGES[401]);

    // Không có đơn, hoặc không phải đơn của mình mà không được xem mọi đơn: cùng trả 404
    const form = getFormDetail(String(params.code), { id: session.user.id, role: session.role });
    if (!form) return apiError(404, FORM_MESSAGES.notFound);
    return HttpResponse.json<FormDetail>(form);
  }),

  // Sửa đơn: câu trả lời mới và tệp mới đến trong một lần. Kiểm tra hết rồi mới lưu; sai một chỗ thì không lưu gì
  http.put(api(ENDPOINTS.forms.update), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_MESSAGES[401]);

    // Không xem được đơn thì 404; xem được mà không sửa được: đơn đã khóa thì 409, không có quyền thì 403
    const code = String(params.code);
    const form = getFormDetail(code, { id: session.user.id, role: session.role });
    if (!form) return apiError(404, FORM_MESSAGES.notFound);
    if (!canEditForm({ id: session.user.id, role: session.role }, { status: form.status, applicantId: form.applicant.id })) {
      return isEditable(form.status) ? apiError(403, FORM_MESSAGES.editForbidden) : apiError(409, FORM_MESSAGES.notEditable);
    }

    // Tách body multipart; sai định dạng thì 422
    const multipart = await readMultipart(request);
    const parsed = UpdateFormRequestSchema.safeParse(multipart?.jsonValue);
    if (!multipart || !parsed.success) return apiError(422, FORM_MESSAGES.invalidBody);
    const { answers, committed } = parsed.data;

    // Câu trả lời sai, chưa cam đoan, hoặc tệp thiếu / sai / thừa thì 422 (kiểm tra theo cấu trúc loại đơn lúc nộp)
    const { invalidSectionTitles } = validateAnswers(form.sections, answers);
    if (invalidSectionTitles.length) return apiError(422, ANSWER_MESSAGES.sectionsToCheck(invalidSectionTitles));
    if (!committed) return apiError(422, ANSWER_MESSAGES.commitmentRequired);
    const fileError = validateSentFiles(form.sections, answers, sentFileInfos(multipart.filesByTempId), getSavedFileIds(code));
    if (fileError) return apiError(422, fileError);

    // Đúng hết: lưu nội dung và tệp mới cùng lúc
    return HttpResponse.json<FormDetail>(updateForm(code, answers, multipart.filesByTempId)!);
  }),

  // Tiếp nhận đơn: Đã nộp / Đã bổ sung → Đang xét, người bấm thành người tiếp nhận và người xử lí
  http.post(api(ENDPOINTS.forms.receive), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, FORM_MESSAGES[401]);

    // Không xem được đơn thì 404; không có quyền receive thì 403; đơn không còn chờ tiếp nhận thì 409
    const code = String(params.code);
    const form = getFormDetail(code, { id: session.user.id, role: session.role });
    if (!form) return apiError(404, FORM_MESSAGES.notFound);
    if (!can(session.role, 'receive')) return apiError(403, FORM_MESSAGES.receiveForbidden);
    if (!isReceivable(form.status)) return apiError(409, FORM_MESSAGES.notReceivable);

    return HttpResponse.json<FormDetail>(receiveForm(code, session.user.id)!);
  }),
];
