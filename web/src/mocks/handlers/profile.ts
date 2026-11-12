/* API giả: hồ sơ cá nhân (xem hồ sơ, xem số CCCD đầy đủ, thông tin sinh viên, chọn MSSV chính, lưu họ tên, CCCD, SĐT),
   hồ sơ người khác (thông tin, CCCD, thông tin sinh viên, đơn đã nộp, đơn phụ trách). */
import { delay, http, HttpResponse } from 'msw';
import {
  COMMON_MESSAGES,
  ENDPOINTS,
  FORM_LIST_DEFAULT_SORTING,
  FORM_LIST_FIELDS,
  HANDLED_FORM_LIST_FIELDS,
  MAIN_STUDENT_MESSAGES,
  PROFILE_MESSAGES,
  STUDENTS_MESSAGES,
  SetMainStudentRequestSchema,
  UpdateProfileRequestSchema,
  applyListQuery,
  can,
  maskCccd,
  type FullCccdResponse,
  type HandledFormsResponse,
  type MyFormsResponse,
  type Profile,
  type Session,
  type StudentInfo,
  type StudentsResponse,
} from '@ulaw/shared';
import {
  findPerson,
  getFormsHandledBy,
  getFormsOf,
  getProfile,
  getStudents,
  isCccdTaken,
  isStudentDirectoryDown,
  readSession,
  saveMainStudent,
  saveProfile,
  toSession,
} from '../db';
import { MOCK_DELAY_MS, api, apiError, readListQuery } from '../http';

/**
 * Dựng hồ sơ trả về cho giao diện: CCCD đã che.
 * @param session  phiên của người đang đăng nhập
 * @returns        hồ sơ theo ProfileSchema
 */
function toProfile(session: Session): Profile {
  const profile = getProfile(session.user.id);
  return { name: profile.name, email: session.user.email, role: session.role, phone: profile.phone, maskedCccd: maskCccd(profile.cccd) };
}

/**
 * Dựng hồ sơ của người khác trả về cho giao diện: CCCD đã che.
 * @param userId  id người dùng (đã biết là có)
 * @returns       hồ sơ theo ProfileSchema
 */
function toPersonProfile(userId: string): Profile {
  const person = findPerson(userId)!;
  return { name: person.name, email: person.email, role: person.role, phone: person.phone, maskedCccd: maskCccd(person.cccd) };
}

/**
 * Dựng thông tin sinh viên trả về cho giao diện: các MSSV và MSSV chính.
 * @param students              các MSSV lấy từ database trường
 * @param chosenMainStudentId   MSSV chính đã chọn; null = chưa chọn
 * @returns                     theo StudentsResponseSchema; MSSV chính là MSSV đã chọn nếu còn trong danh sách, không thì MSSV đầu
 */
function toStudentsResponse(students: StudentInfo[], chosenMainStudentId: string | null): StudentsResponse {
  const chosen = students.find((student) => student.studentId === chosenMainStudentId);
  return { students, mainStudentId: (chosen ?? students[0])?.studentId ?? null };
}

/**
 * Câu trả lỗi 503 khi database sinh viên của trường "không kết nối được" (chỉ có ở API giả, để xem giao diện báo lỗi).
 * @param userId  id người cần lấy thông tin sinh viên
 * @returns       câu trả lỗi 503; database trường bình thường thì null
 */
function studentDirectoryError(userId: string): Response | null {
  return isStudentDirectoryDown(userId) ? apiError(503, STUDENTS_MESSAGES[503]) : null;
}

/**
 * Tìm người dùng mà người đang đăng nhập được xem hồ sơ (quyền viewApplicant).
 * @param userId  id người dùng cần xem (từ đường dẫn)
 * @returns       person: người cần xem · errorResponse: câu trả lỗi nếu chưa đăng nhập (401), không có quyền (403) hoặc không có người đó (404)
 */
function personToView(userId: string) {
  const session = readSession();
  if (!session) return { errorResponse: apiError(401, PROFILE_MESSAGES[401]) };
  if (!can(session.role, 'viewApplicant')) return { errorResponse: apiError(403, PROFILE_MESSAGES[403]) };
  const person = findPerson(userId);
  if (!person) return { errorResponse: apiError(404, PROFILE_MESSAGES[404]) };
  return { person };
}

export const profileHandlers = [
  // Hồ sơ của mình
  http.get(api(ENDPOINTS.profile.me), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, PROFILE_MESSAGES[401]);
    return HttpResponse.json<Profile>(toProfile(session));
  }),

  // Số CCCD đầy đủ của mình (người dùng bấm "Hiện")
  http.get(api(ENDPOINTS.profile.myCccd), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, PROFILE_MESSAGES[401]);
    return HttpResponse.json<FullCccdResponse>({ cccd: getProfile(session.user.id).cccd });
  }),

  // Thông tin sinh viên của mình (lấy từ database trường)
  http.get(api(ENDPOINTS.profile.myStudents), async () => {
    await delay(MOCK_DELAY_MS);
    const session = readSession();
    if (!session) return apiError(401, PROFILE_MESSAGES[401]);
    const directoryError = studentDirectoryError(session.user.id);
    if (directoryError) return directoryError;
    return HttpResponse.json<StudentsResponse>(toStudentsResponse(getStudents(session.user.id), getProfile(session.user.id).mainStudentId));
  }),

  // Chọn MSSV chính: MSSV phải thuộc email của mình
  http.put(api(ENDPOINTS.profile.myMainStudent), async ({ request }) => {
    await delay(MOCK_DELAY_MS);

    // Chưa đăng nhập thì 401
    const session = readSession();
    if (!session) return apiError(401, PROFILE_MESSAGES[401]);

    // Body sai, hoặc MSSV không thuộc mình thì 422
    const parsed = SetMainStudentRequestSchema.safeParse(await request.json().catch(() => null));
    const { studentId } = parsed.success ? parsed.data : { studentId: '' };
    const owned = getStudents(session.user.id).some((student) => student.studentId === studentId);
    if (!owned) return apiError(422, MAIN_STUDENT_MESSAGES[422]);

    // Lưu rồi trả thông tin sinh viên mới
    saveMainStudent(session.user.id, studentId);
    return HttpResponse.json<StudentsResponse>(toStudentsResponse(getStudents(session.user.id), studentId));
  }),

  // Lưu hồ sơ của mình: kiểm tra body, kiểm tra CCCD không trùng, rồi trả phiên mới (đã bổ sung thông tin)
  http.put(api(ENDPOINTS.profile.me), async ({ request }) => {
    await delay(MOCK_DELAY_MS);

    // Chưa đăng nhập thì 401
    const session = readSession();
    if (!session) return apiError(401, PROFILE_MESSAGES[401]);

    // Body sai định dạng thì 422, kèm câu báo lỗi của ô đầu tiên bị sai
    const parsed = UpdateProfileRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, parsed.error.issues[0]?.message ?? PROFILE_MESSAGES[422]);

    // CCCD đã thuộc tài khoản khác thì 409
    const { cccd } = parsed.data;
    if (cccd && isCccdTaken(cccd, session.user.id)) return apiError(409, PROFILE_MESSAGES[409]);

    // Lưu rồi trả phiên mới để giao diện cập nhật họ tên và bỏ màn Bổ sung thông tin
    saveProfile(session.user.id, parsed.data);
    return HttpResponse.json<Session>(toSession(session.user.id));
  }),

  // Hồ sơ của người khác (chỉ xem, CCCD che). Đặt sau các đường dẫn /profile/me để 'me' không bị hiểu là id
  http.get(api(ENDPOINTS.profile.person), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const { person, errorResponse } = personToView(String(params.userId));
    if (!person) return errorResponse;
    return HttpResponse.json<Profile>(toPersonProfile(String(params.userId)));
  }),

  // Số CCCD đầy đủ của người khác (người xem bấm "Hiện")
  http.get(api(ENDPOINTS.profile.personCccd), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const { person, errorResponse } = personToView(String(params.userId));
    if (!person) return errorResponse;
    return HttpResponse.json<FullCccdResponse>({ cccd: person.cccd });
  }),

  // Thông tin sinh viên của người khác (lấy từ database trường)
  http.get(api(ENDPOINTS.profile.personStudents), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const userId = String(params.userId);
    const { person, errorResponse } = personToView(userId);
    if (!person) return errorResponse;
    const directoryError = studentDirectoryError(userId);
    if (directoryError) return directoryError;
    return HttpResponse.json<StudentsResponse>(toStudentsResponse(person.students, person.mainStudentId));
  }),

  // Một trang trong các đơn người khác đã nộp
  http.get(api(ENDPOINTS.profile.personForms), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const { person, errorResponse } = personToView(String(params.userId));
    if (!person) return errorResponse;
    const listQuery = readListQuery(request, FORM_LIST_FIELDS);
    if (!listQuery) return apiError(422, COMMON_MESSAGES.listQuery);
    const personForms = getFormsOf(String(params.userId));
    const { rows, ...pageMeta } = applyListQuery(personForms, FORM_LIST_FIELDS, listQuery, FORM_LIST_DEFAULT_SORTING);
    return HttpResponse.json<MyFormsResponse>({ forms: rows, ...pageMeta });
  }),

  // Một trang trong các đơn một cán bộ khác tiếp nhận hoặc đang xử lí (mục "Đơn phụ trách"): cần thêm quyền viewAll
  http.get(api(ENDPOINTS.profile.personHandledForms), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);
    const { person, errorResponse } = personToView(String(params.userId));
    if (!person) return errorResponse;
    if (!can(readSession()?.role, 'viewAll')) return apiError(403, PROFILE_MESSAGES.handledFormsForbidden);
    const listQuery = readListQuery(request, HANDLED_FORM_LIST_FIELDS);
    if (!listQuery) return apiError(422, COMMON_MESSAGES.listQuery);
    const handledForms = getFormsHandledBy(String(params.userId));
    const { rows, ...pageMeta } = applyListQuery(handledForms, HANDLED_FORM_LIST_FIELDS, listQuery, FORM_LIST_DEFAULT_SORTING);
    return HttpResponse.json<HandledFormsResponse>({ forms: rows, ...pageMeta });
  }),

  // Chọn MSSV chính cho người khác: cần thêm quyền editApplicant, MSSV phải thuộc email của người đó
  http.put(api(ENDPOINTS.profile.personMainStudent), async ({ params, request }) => {
    await delay(MOCK_DELAY_MS);

    // Chưa đăng nhập / không xem được / không có người đó thì 401 / 403 / 404; không có quyền sửa thì 403
    const userId = String(params.userId);
    const { person, errorResponse } = personToView(userId);
    if (!person) return errorResponse;
    if (!can(readSession()?.role, 'editApplicant')) return apiError(403, MAIN_STUDENT_MESSAGES[403]);

    // Body sai, hoặc MSSV không thuộc người đó thì 422
    const parsed = SetMainStudentRequestSchema.safeParse(await request.json().catch(() => null));
    const { studentId } = parsed.success ? parsed.data : { studentId: '' };
    const owned = person.students.some((student) => student.studentId === studentId);
    if (!owned) return apiError(422, MAIN_STUDENT_MESSAGES.personNotOwned);

    // Lưu rồi trả thông tin sinh viên mới của người đó
    saveMainStudent(userId, studentId);
    return HttpResponse.json<StudentsResponse>(toStudentsResponse(person.students, studentId));
  }),
];
