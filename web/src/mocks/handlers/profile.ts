/* API giả: hồ sơ cá nhân (xem hồ sơ, xem số CCCD đầy đủ, chọn MSSV chính, lưu họ tên, CCCD, SĐT). */
import { delay, http, HttpResponse } from 'msw';
import {
  ENDPOINTS,
  MAIN_STUDENT_MESSAGES,
  PROFILE_MESSAGES,
  SetMainStudentRequestSchema,
  UpdateProfileRequestSchema,
  maskCccd,
  type FullCccdResponse,
  type Profile,
  type Session,
} from '@ulaw/shared';
import { getProfile, getStudents, isCccdTaken, readSession, saveMainStudent, saveProfile, toSession } from '../db';
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
    phone: profile.phone,
    maskedCccd: maskCccd(profile.cccd),
    students,
    mainStudentId,
  };
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
    return HttpResponse.json<Session>(toSession(session.role));
  }),
];
