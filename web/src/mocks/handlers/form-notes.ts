/* API giả: Ghi chú nội bộ trên lá đơn (xem, thêm, sửa, xóa). Chỉ vai trò có quyền internalNotes; sửa, xóa chỉ ghi chú của mình. */
import { delay, http, HttpResponse } from 'msw';
import {
  ENDPOINTS,
  FORM_NOTE_COUNTS_PARAM,
  FORM_NOTE_MESSAGES,
  SaveFormNoteRequestSchema,
  can,
  canEditFormNote,
  parseFormNoteCountsParam,
  type FormNoteCountsResponse,
  type FormNote,
  type FormNotesResponse,
  type SaveFormNoteRequest,
  type Session,
} from '@ulaw/shared';
import { addFormNote, countFormNotes, deleteFormNote, findFormNote, formExists, getFormNotes, readSession, updateFormNote } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

/**
 * Kiểm tra người đang đăng nhập có quyền internalNotes và lá đơn có tồn tại.
 * @param code  mã đơn trên đường dẫn
 * @returns     session: phiên đăng nhập · errorResponse: chưa đăng nhập (401), không có quyền (403), không có đơn (404)
 */
async function checkAccess(code: string): Promise<{ session: Session; errorResponse: null } | { session: null; errorResponse: Response }> {
  const session = await readSession();
  if (!session) return { session: null, errorResponse: apiError(401, FORM_NOTE_MESSAGES[401]) };
  if (!can(session.role, 'internalNotes')) return { session: null, errorResponse: apiError(403, FORM_NOTE_MESSAGES[403]) };
  if (!(await formExists(code))) return { session: null, errorResponse: apiError(404, FORM_NOTE_MESSAGES.formNotFound) };
  return { session, errorResponse: null };
}

/**
 * Đọc nội dung ghi chú trong body.
 * @param request  request MSW chặn được
 * @returns        body đã kiểm tra · errorResponse: 422 kèm câu báo (nội dung trống, hoặc sai dạng)
 */
async function readNoteBody(request: Request): Promise<{ body: SaveFormNoteRequest; errorResponse: null } | { body: null; errorResponse: Response }> {
  const parsed = SaveFormNoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return { body: parsed.data, errorResponse: null };
  const emptyContent = parsed.error.issues.some((issue) => issue.message === FORM_NOTE_MESSAGES.empty);
  return { body: null, errorResponse: apiError(422, emptyContent ? FORM_NOTE_MESSAGES.empty : FORM_NOTE_MESSAGES.invalidRequest) };
}

/**
 * Tìm ghi chú cần sửa / xóa và kiểm tra người đang đăng nhập là người viết.
 * @param code     mã đơn
 * @param noteId   id ghi chú
 * @param session  phiên đăng nhập
 * @returns        câu trả lỗi: không có ghi chú (404), không phải người viết (403); được sửa thì null
 */
function noteAccessError(code: string, noteId: string, session: Session): Response | null {
  const note = findFormNote(code, noteId);
  if (!note) return apiError(404, FORM_NOTE_MESSAGES.noteNotFound);
  if (!canEditFormNote({ id: session.user.id, role: session.role }, note)) return apiError(403, FORM_NOTE_MESSAGES.notAuthor);
  return null;
}

export const formNoteHandlers = [
  // Số ghi chú của nhiều đơn (cột Ghi chú của bảng đơn); mã đơn không có thì 0
  http.get(api(ENDPOINTS.formNotes.counts), async ({ request }) => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, FORM_NOTE_MESSAGES[401]);
    if (!can(session.role, 'internalNotes')) return apiError(403, FORM_NOTE_MESSAGES[403]);
    const codes = parseFormNoteCountsParam(new URL(request.url).searchParams.get(FORM_NOTE_COUNTS_PARAM));
    return HttpResponse.json<FormNoteCountsResponse>({ counts: countFormNotes(codes) });
  }),

  // Các ghi chú của lá đơn
  http.get(api(ENDPOINTS.formNotes.list), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const code = String(params.code);
    const { errorResponse } = await checkAccess(code);
    if (errorResponse) return errorResponse;
    return HttpResponse.json<FormNotesResponse>({ notes: getFormNotes(code) });
  }),

  // Thêm ghi chú: người viết là người đang đăng nhập
  http.post(api(ENDPOINTS.formNotes.list), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const code = String(params.code);
    const { session, errorResponse } = await checkAccess(code);
    if (errorResponse) return errorResponse;
    const noteBody = await readNoteBody(request);
    if (noteBody.errorResponse) return noteBody.errorResponse;

    const author = { id: session.user.id, name: session.user.name, email: session.user.email };
    return HttpResponse.json<FormNote>(addFormNote(code, noteBody.body.content, author), { status: 201 });
  }),

  // Sửa nội dung ghi chú của mình
  http.patch(api(ENDPOINTS.formNotes.note), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const code = String(params.code);
    const noteId = String(params.noteId);
    const { session, errorResponse } = await checkAccess(code);
    if (errorResponse) return errorResponse;
    const accessError = noteAccessError(code, noteId, session);
    if (accessError) return accessError;
    const noteBody = await readNoteBody(request);
    if (noteBody.errorResponse) return noteBody.errorResponse;

    return HttpResponse.json<FormNote>(updateFormNote(code, noteId, noteBody.body.content));
  }),

  // Xóa ghi chú của mình
  http.delete(api(ENDPOINTS.formNotes.note), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const code = String(params.code);
    const noteId = String(params.noteId);
    const { session, errorResponse } = await checkAccess(code);
    if (errorResponse) return errorResponse;
    const accessError = noteAccessError(code, noteId, session);
    if (accessError) return accessError;

    deleteFormNote(code, noteId);
    return new HttpResponse(null, { status: 204 });
  }),
];
