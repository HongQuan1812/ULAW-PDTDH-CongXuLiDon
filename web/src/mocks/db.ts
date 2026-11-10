/* Dữ liệu giả của API giả, giữ trong bộ nhớ trình duyệt. */
import type { RoleId, Session, SessionUser, StudentInfo, UpdateProfileRequest } from '@ulaw/shared';

/* Tài khoản mẫu để đăng nhập thử: mỗi vai trò một người (lấy từ artifact/js/auth.js và sample-data.js). */
export const DEMO_USERS: Record<RoleId, SessionUser> = {
  nguoiNopDon: { id: 'sv-1', email: 'minhanh.nguyen@hcmulaw.edu.vn', name: 'Nguyễn Minh Anh' },
  nguoiXuLiDon: { id: 'cb-1', email: 'thuha.pham.pdt@hcmulaw.edu.vn', name: 'Phạm Thu Hà' },
  admin: { id: 'cb-3', email: 'ngocdiep.le.pdt@hcmulaw.edu.vn', name: 'Lê Ngọc Diệp' },
};

/* ---------- Hồ sơ cá nhân ---------- */

/** Hồ sơ lưu trong API giả: họ tên, SĐT, CCCD (null = chưa có), đã bổ sung thông tin lần đầu hay chưa,
    và MSSV chính người dùng đã chọn (null = chưa chọn, dùng MSSV đầu). */
export interface MockProfile {
  name: string;
  phone: string | null;
  cccd: string | null;
  completed: boolean;
  mainStudentId: string | null;
}

/* Hồ sơ ban đầu, khóa theo id người dùng. Sinh viên chưa bổ sung thông tin (để thấy màn Bổ sung thông tin
   lần đầu); cán bộ có sẵn hồ sơ và CCCD (để thử báo trùng CCCD). Số liệu tổng hợp, không phải dữ liệu thật. */
const SEED_PROFILES: Record<string, MockProfile> = {
  'sv-1': { name: 'Nguyễn Minh Anh', phone: null, cccd: null, completed: false, mainStudentId: null },
  'cb-1': { name: 'Phạm Thu Hà', phone: '0912345678', cccd: '079188001122', completed: true, mainStudentId: null },
  'cb-3': { name: 'Lê Ngọc Diệp', phone: '0987654321', cccd: '079190003344', completed: true, mainStudentId: null },
};

/* Hồ sơ đã sửa, lưu trong sessionStorage để tải lại trang không phải bổ sung thông tin lại
   (giống phiên đăng nhập bên dưới). Đóng tab là mất. */
const PROFILES_KEY = 'mock-profiles';

/**
 * Sao chép hồ sơ ban đầu để không sửa vào bản gốc.
 * @returns  bản sao của SEED_PROFILES
 */
function cloneSeed(): Record<string, MockProfile> {
  return Object.fromEntries(Object.entries(SEED_PROFILES).map(([id, profile]) => [id, { ...profile }]));
}

/**
 * Đọc hồ sơ đã lưu trong sessionStorage, chồng lên hồ sơ ban đầu.
 * @returns  hồ sơ của mọi tài khoản mẫu; không đọc được thì dùng hồ sơ ban đầu
 */
function loadProfiles(): Record<string, MockProfile> {
  const seed = cloneSeed();
  try {
    const raw = sessionStorage.getItem(PROFILES_KEY);
    return raw ? { ...seed, ...(JSON.parse(raw) as Record<string, MockProfile>) } : seed;
  } catch {
    // Trình duyệt chặn bộ nhớ hoặc dữ liệu hỏng: dùng hồ sơ ban đầu
    return seed;
  }
}

let profiles = loadProfiles();

/**
 * Lưu hồ sơ vào sessionStorage.
 * @param next  hồ sơ của mọi tài khoản mẫu
 */
function persistProfiles(next: Record<string, MockProfile>): void {
  try {
    sessionStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  } catch {
    // Trình duyệt chặn bộ nhớ: hồ sơ chỉ không giữ được khi tải lại trang
  }
}

/**
 * Lấy hồ sơ của một tài khoản.
 * @param userId  id tài khoản, vd 'sv-1'
 * @returns       hồ sơ hiện tại
 */
export function getProfile(userId: string): MockProfile {
  const profile = profiles[userId];
  if (!profile) throw new Error(`Không có hồ sơ giả cho tài khoản ${userId}`);
  return profile;
}

/**
 * Lưu họ tên, CCCD, SĐT của một tài khoản và đánh dấu đã bổ sung thông tin.
 * @param userId  id tài khoản
 * @param input   dữ liệu đã kiểm tra; cccd và phone là chuỗi rỗng nghĩa là không có
 * @returns       hồ sơ sau khi lưu
 */
export function saveProfile(userId: string, input: UpdateProfileRequest): MockProfile {
  const saved: MockProfile = {
    ...getProfile(userId),
    name: input.name,
    cccd: input.cccd || null,
    phone: input.phone || null,
    completed: true,
  };
  profiles = { ...profiles, [userId]: saved };
  persistProfiles(profiles);
  return saved;
}

/**
 * Lưu MSSV chính của một tài khoản.
 * @param userId     id tài khoản
 * @param studentId  MSSV đã kiểm tra là thuộc tài khoản này
 */
export function saveMainStudent(userId: string, studentId: string): void {
  profiles = { ...profiles, [userId]: { ...getProfile(userId), mainStudentId: studentId } };
  persistProfiles(profiles);
}

/**
 * CCCD đã thuộc tài khoản khác chưa (mỗi CCCD chỉ một tài khoản).
 * @param cccd          số CCCD cần kiểm tra
 * @param exceptUserId  tài khoản của chính người đang lưu, không tính là trùng
 * @returns             true nếu có tài khoản khác đang dùng số này
 */
export function isCccdTaken(cccd: string, exceptUserId: string): boolean {
  return Object.entries(profiles).some(([id, profile]) => id !== exceptUserId && profile.cccd === cccd);
}

/* Các MSSV "lấy từ database trường" theo email (lấy từ artifact/js/auth.js), chỉ đọc nên không lưu lại.
   Sinh viên mẫu có 2 MSSV (học thêm văn bằng 2), MSSV trùng email đứng đầu. Cán bộ không có MSSV. */
const STUDENT_DIRECTORY: Record<string, StudentInfo[]> = {
  'sv-1': [
    {
      studentId: '2253801010001',
      className: '47-LTM-A',
      trainingMode: 'Chính quy',
      major: 'Luật Thương mại quốc tế',
      currentCohort: 'K47 (2022–2026)',
      originalCohort: 'K47 (2022–2026)',
    },
    {
      studentId: '2523801040017',
      className: 'VB2-25B',
      trainingMode: 'Văn bằng 2',
      major: 'Luật',
      currentCohort: 'VB2 K25',
      originalCohort: 'VB2 K25',
    },
  ],
};

/**
 * Lấy các MSSV của một tài khoản.
 * @param userId  id tài khoản
 * @returns       danh sách MSSV (MSSV trùng email đứng đầu); không có thì []
 */
export function getStudents(userId: string): StudentInfo[] {
  return STUDENT_DIRECTORY[userId] ?? [];
}

/** Đưa hồ sơ về ban đầu (dùng trong test). */
export function resetMockDb(): void {
  profiles = cloneSeed();
  try {
    sessionStorage.removeItem(PROFILES_KEY);
  } catch {
    // Không có sessionStorage (vd chạy test): bỏ qua
  }
}

/* ---------- Phiên đăng nhập ---------- */

/**
 * Dựng phiên đăng nhập từ vai trò: người dùng (họ tên theo hồ sơ mới nhất) + vai trò + đã bổ sung thông tin chưa.
 * @param role  vai trò đang đăng nhập
 * @returns     phiên đăng nhập
 */
export function toSession(role: RoleId): Session {
  const user = DEMO_USERS[role];
  const profile = getProfile(user.id);
  return { user: { ...user, name: profile.name }, role, profileCompleted: profile.completed };
}

/* Vai trò đang đăng nhập, lưu trong sessionStorage để tải lại trang không bị đăng xuất
   (giống cookie phiên của backend thật). Đóng tab là mất. */
const SESSION_KEY = 'mock-session-role';

/**
 * Đọc phiên đăng nhập giả hiện tại.
 * @returns  phiên (người dùng + vai trò); chưa đăng nhập thì null
 */
export function readSession(): Session | null {
  // Đọc vai trò đã lưu (trình duyệt chặn bộ nhớ thì coi như chưa đăng nhập)
  let role: string | null = null;
  try {
    role = sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }

  // Vai trò không hợp lệ thì coi như chưa đăng nhập
  if (!role || !(role in DEMO_USERS)) return null;
  return toSession(role as RoleId);
}

/**
 * Ghi hoặc xóa phiên đăng nhập giả.
 * @param role  vai trò đăng nhập; null = đăng xuất
 */
export function writeSession(role: RoleId | null): void {
  try {
    if (role) sessionStorage.setItem(SESSION_KEY, role);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Trình duyệt chặn bộ nhớ: phiên chỉ không giữ được khi tải lại trang
  }
}
