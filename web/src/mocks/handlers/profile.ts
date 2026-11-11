/* API giả: hồ sơ cá nhân (xem hồ sơ, xem số CCCD đầy đủ, chọn MSSV chính, lưu họ tên, CCCD, SĐT),
   hồ sơ người khác (thông tin, CCCD, đơn đã nộp, đơn phụ trách). */
import { delay, http, HttpResponse } from 'msw';
import {
  ENDPOINTS,
  MAIN_STUDENT_MESSAGES,
  PROFILE_MESSAGES,
  SetMainStudentRequestSchema,
  UpdateProfileRequestSchema,
  can,
  maskCccd,
  type FullCccdResponse,
  type HandledFormsResponse,
  type MyFormsResponse,
  type Profile,
  type Session,
} from '@ulaw/shared';
import {
  findPerson,
  getFormsHandledBy,
  getFormsOf,
  getProfile,
  getStudents,
  isCccdTaken,
  readSession,
  saveMainStudent,
  saveProfile,
  toSession,
} from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

/**
 * Dựng hồ sơ trả về cho giao diện: CCCD đã che, các MSSV, MSSV chính.
 * @param session  phiên của người đang đăng nhập
 * @returns        hồ sơ theo ProfileSchema
 */
function toProfile(session: Session): Profile {
  const profile = getProfile(session.user.id);
  const students = getStudents(session.user.id);

  // MSSV chính: MSSV đã chọn nếu còn trong danh sách, không thì MSSV đầu
  const chosen = students.find((student) => student.studentId === profile.mainStudentId);
  const mainStudentId = (chosen ?? students[0])?.studentId ?? null;

  return {
    name: profile.name,
    email: session.user.email,
    role: session.role,
    phone: profile.phone,
    maskedCccd: maskCccd(profile.cccd),
    students,
    mainStudentId,
  };
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

    // Lưu rồi trả hồ sơ mới
    saveMainStudent(session.user.id, studentId);
    return HttpResponse.json<Profile>(toProfile(session));
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

    // MSSV chính: MSSV đã chọn nếu còn trong danh sách, không thì MSSV đầu
    const mainStudent = person.students.find((student) => student.studentId === person.mainStudentId) ?? person.students[0];
    return HttpResponse.json<Profile>({
      name: person.name,
      email: person.email,
      role: person.role,
      phone: person.phone,
      maskedCccd: maskCccd(person.cccd),
      students: person.students,
      mainStudentId: mainStudent?.studentId ?? null,
    });
  }),

  // Số CCCD đầy đủ của người khác (người xem bấm "Hiện")
  http.get(api(ENDPOINTS.profile.personCccd), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const { person, errorResponse } = personToView(String(params.userId));
    if (!person) return errorResponse;
    return HttpResponse.json<FullCccdResponse>({ cccd: person.cccd });
  }),

  // Các đơn người khác đã nộp
  http.get(api(ENDPOINTS.profile.personForms), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const { person, errorResponse } = personToView(String(params.userId));
    if (!person) return errorResponse;
    return HttpResponse.json<MyFormsResponse>({ forms: getFormsOf(String(params.userId)) });
  }),

  // Các đơn một cán bộ khác tiếp nhận hoặc đang xử lí (mục "Đơn phụ trách"): cần thêm quyền viewAll
  http.get(api(ENDPOINTS.profile.personHandledForms), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const { person, errorResponse } = personToView(String(params.userId));
    if (!person) return errorResponse;
    if (!can(readSession()?.role, 'viewAll')) return apiError(403, PROFILE_MESSAGES.handledFormsForbidden);
    return HttpResponse.json<HandledFormsResponse>({ forms: getFormsHandledBy(String(params.userId)) });
  }),
];
