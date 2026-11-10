/* API giả: lá đơn (nộp đơn mới, danh sách đơn của mình, đơn phụ trách). */
import { delay, http, HttpResponse } from 'msw';
import {
  ANSWER_MESSAGES,
  ENDPOINTS,
  FORM_MESSAGES,
  SUBMIT_FORM_FIELDS,
  SubmitFormRequestSchema,
  can,
  validateAnswers,
  validateSentFiles,
  type FormSummary,
  type HandledFormsResponse,
  type MyFormsResponse,
} from '@ulaw/shared';
import { addForm, getFormType, getFormsHandledBy, getFormsOf, readSession } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

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
    const body = await request.formData().catch(() => null);
    const requestText = body?.get(SUBMIT_FORM_FIELDS.request);
    const parsed = SubmitFormRequestSchema.safeParse(typeof requestText === 'string' ? readJson(requestText) : null);
    if (!body || !parsed.success) return apiError(422, FORM_MESSAGES.invalidBody);
    const { formTypeId, answers, committed } = parsed.data;
    const filesByTempId = new Map<string, File>();
    body.forEach((part, fieldName) => {
      if (part instanceof File) filesByTempId.set(fieldName, part);
    });

    // Loại đơn không có hoặc không còn nhận đơn thì 404
    const formType = getFormType(formTypeId, false);
    if (!formType) return apiError(404, FORM_MESSAGES.formTypeClosed);

    // Câu trả lời sai, chưa cam đoan, hoặc tệp thiếu / sai định dạng / quá dung lượng / thừa thì 422; câu báo giống trang nộp đơn
    const { invalidSectionTitles } = validateAnswers(formType.sections, answers);
    if (invalidSectionTitles.length) return apiError(422, ANSWER_MESSAGES.sectionsToCheck(invalidSectionTitles));
    if (!committed) return apiError(422, ANSWER_MESSAGES.commitmentRequired);
    const sentFiles = new Map([...filesByTempId].map(([tempId, file]) => [tempId, { name: file.name, sizeBytes: file.size }]));
    const fileError = validateSentFiles(formType.sections, answers, sentFiles);
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
];
