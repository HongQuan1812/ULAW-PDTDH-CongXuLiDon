/* Dữ liệu giả của API giả, giữ trong bộ nhớ trình duyệt. */
import type {
  Account,
  ApplicantRef,
  CreateAccountRequest,
  ExportSource,
  ExportTemplate,
  FileRef,
  FormAnswers,
  FormDecision,
  FormDetail,
  FormSection,
  FormStats,
  FormStatus,
  FormSummary,
  FormType,
  FormTypeStatus,
  FormTypeSummary,
  FormTypeVersion,
  HandledFormSummary,
  ManagedFormType,
  ManagedFormSummary,
  OpenFormType,
  RoleId,
  SaveFormTypeVersionRequest,
  Session,
  SessionUser,
  StaffRef,
  StudentInfo,
  TableCell,
  UpdateAccountRequest,
  UpdateProfileRequest,
} from '@ulaw/shared';
import {
  ACCOUNT_MESSAGES,
  FORM_STATUSES,
  FORM_TYPE_MESSAGES,
  FormTypeSchema,
  can,
  formatFormCode,
  isAnswerable,
  maskCccd,
  nextFormCode,
} from '@ulaw/shared';
import { buildSamplePdf } from './samplePdf';
import { SAMPLE_EXPORT_TEMPLATE_BASE64 } from './sampleExportTemplate';

/* ---------- Tài khoản (hồ sơ, vai trò) ---------- */

/** Một tài khoản trong API giả: email (không đổi được), vai trò, họ tên, SĐT, CCCD (null = chưa có),
    đã bổ sung thông tin lần đầu hay chưa, và MSSV chính người dùng đã chọn (null = chưa chọn, dùng MSSV đầu). */
export interface MockAccount {
  email: string;
  role: RoleId;
  name: string;
  phone: string | null;
  cccd: string | null;
  completed: boolean;
  mainStudentId: string | null;
}

/** Ghi tắt một tài khoản mẫu: người dùng sẵn có, đã bổ sung thông tin, chưa có SĐT, CCCD. */
const seedAccount = (name: string, email: string, role: RoleId): MockAccount => ({
  email,
  role,
  name,
  phone: null,
  cccd: null,
  completed: true,
  mainStudentId: null,
});

/* Tài khoản ban đầu, khóa theo id (lấy từ artifact/js/auth.js và sample-data.js). Họ tên, email, số liệu tổng hợp, không phải người thật.
   - sv-1, cb-1, cb-3: tài khoản đăng nhập thử của 3 vai trò (DEMO_USER_IDS). sv-1 chưa bổ sung thông tin (để thấy màn Bổ sung thông tin
     lần đầu); cb-1, cb-3 có sẵn CCCD (để thử báo trùng CCCD).
   - cb-2: cán bộ thứ ba (như SAMPLE_STAFF). sv-2 … sv-11: 10 sinh viên khác (như seedOthers()). */
const SEED_ACCOUNTS: Record<string, MockAccount> = {
  'sv-1': { ...seedAccount('Nguyễn Minh Anh', 'minhanh.nguyen@hcmulaw.edu.vn', 'nguoiNopDon'), completed: false },
  'cb-1': { ...seedAccount('Phạm Thu Hà', 'thuha.pham.pdt@hcmulaw.edu.vn', 'nguoiXuLiDon'), phone: '0912345678', cccd: '079188001122' },
  'cb-2': seedAccount('Trần Quốc Việt', 'quocviet.tran.pdt@hcmulaw.edu.vn', 'nguoiXuLiDon'),
  'cb-3': { ...seedAccount('Lê Ngọc Diệp', 'ngocdiep.le.pdt@hcmulaw.edu.vn', 'admin'), phone: '0987654321', cccd: '079190003344' },
  ...Object.fromEntries(
    [
      ['Trần Thị Bảo Ngọc', 'baongoc.tran@hcmulaw.edu.vn'],
      ['Lê Hoàng Phúc', 'phuc.lehoang@hcmulaw.edu.vn'],
      ['Phạm Gia Hân', 'giahan.pham06@hcmulaw.edu.vn'],
      ['Võ Minh Khang', 'khangvo.law@hcmulaw.edu.vn'],
      ['Đặng Thùy Linh', 'thuylinh.dang@hcmulaw.edu.vn'],
      ['Huỳnh Quốc Bảo', 'quocbao.huynh@hcmulaw.edu.vn'],
      ['Ngô Phương Thảo', 'thao.ngophuong@hcmulaw.edu.vn'],
      ['Bùi Đức Anh', 'ducanh.bui.k51@hcmulaw.edu.vn'],
      ['Trương Ngọc Mai', 'ngocmai.truong@hcmulaw.edu.vn'],
      ['Đỗ Thành Nam', 'thanhnam.do@hcmulaw.edu.vn'],
    ].map(([name, email], i) => [`sv-${i + 2}`, seedAccount(name!, email!, 'nguoiNopDon')]),
  ),
};

/* Tài khoản đăng nhập thử của mỗi vai trò (JUST FOR DEMO: ô đổi vai trò). */
export const DEMO_USER_IDS: Record<RoleId, string> = { nguoiNopDon: 'sv-1', nguoiXuLiDon: 'cb-1', admin: 'cb-3' };

/* Tài khoản đã tạo / sửa, lưu trong sessionStorage để tải lại trang không phải bổ sung thông tin lại
   (giống phiên đăng nhập bên dưới). Đóng tab là mất. */
const ACCOUNTS_KEY = 'mock-accounts';

/**
 * Sao chép tài khoản ban đầu để không sửa vào bản gốc.
 * @returns  bản sao của SEED_ACCOUNTS
 */
function cloneSeed(): Record<string, MockAccount> {
  return Object.fromEntries(Object.entries(SEED_ACCOUNTS).map(([id, account]) => [id, { ...account }]));
}

/**
 * Đọc tài khoản đã lưu trong sessionStorage, chồng lên tài khoản ban đầu (từng ô một, nên bản lưu thiếu ô vẫn dùng được).
 * @returns  mọi tài khoản; không đọc được thì dùng tài khoản ban đầu
 */
function loadAccounts(): Record<string, MockAccount> {
  const seed = cloneSeed();
  try {
    const raw = sessionStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return seed;
    const saved = JSON.parse(raw) as Record<string, Partial<MockAccount>>;
    for (const [id, account] of Object.entries(saved)) seed[id] = { ...seed[id], ...account } as MockAccount;
    return seed;
  } catch {
    return seed;
  }
}

/* Mọi tài khoản, khóa theo id. Thứ tự: tài khoản ban đầu rồi tài khoản mới tạo. */
let accounts = loadAccounts();

/**
 * Lưu mọi tài khoản vào sessionStorage.
 * @param next  mọi tài khoản
 */
function persistAccounts(next: Record<string, MockAccount>): void {
  try {
    sessionStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    // Trình duyệt chặn bộ nhớ: tài khoản chỉ không giữ được khi tải lại trang
  }
}

/**
 * Ghi đè một tài khoản rồi lưu lại.
 * @param userId   id tài khoản
 * @param account  tài khoản mới
 * @returns        tài khoản vừa lưu
 */
function putAccount(userId: string, account: MockAccount): MockAccount {
  accounts = { ...accounts, [userId]: account };
  persistAccounts(accounts);
  return account;
}

/**
 * Lấy một tài khoản.
 * @param userId  id tài khoản, vd 'sv-1'
 * @returns       tài khoản hiện tại
 */
export function getProfile(userId: string): MockAccount {
  const account = accounts[userId];
  if (!account) throw new Error(`Không có tài khoản giả ${userId}`);
  return account;
}

/**
 * Lưu họ tên, CCCD, SĐT của một tài khoản và đánh dấu đã bổ sung thông tin.
 * @param userId  id tài khoản
 * @param input   dữ liệu đã kiểm tra; cccd và phone là chuỗi rỗng nghĩa là không có
 * @returns       tài khoản sau khi lưu
 */
export function saveProfile(userId: string, input: UpdateProfileRequest): MockAccount {
  return putAccount(userId, {
    ...getProfile(userId),
    name: input.name,
    cccd: input.cccd || null,
    phone: input.phone || null,
    completed: true,
  });
}

/**
 * Lưu MSSV chính của một tài khoản.
 * @param userId     id tài khoản
 * @param studentId  MSSV đã kiểm tra là thuộc tài khoản này
 */
export function saveMainStudent(userId: string, studentId: string): void {
  putAccount(userId, { ...getProfile(userId), mainStudentId: studentId });
}

/**
 * CCCD đã thuộc tài khoản khác chưa (mỗi CCCD chỉ một tài khoản).
 * @param cccd          số CCCD cần kiểm tra
 * @param exceptUserId  tài khoản của chính người đang lưu, không tính là trùng
 * @returns             true nếu có tài khoản khác đang dùng số này
 */
export function isCccdTaken(cccd: string, exceptUserId: string): boolean {
  return Object.entries(accounts).some(([id, account]) => id !== exceptUserId && account.cccd === cccd);
}

/**
 * Email đã có tài khoản chưa (không phân biệt hoa thường).
 * @param email  email cần kiểm tra
 * @returns      true nếu đã có tài khoản dùng email này
 */
function isEmailTaken(email: string): boolean {
  return Object.values(accounts).some((account) => account.email.toLowerCase() === email.toLowerCase());
}

/**
 * Dựng một dòng của bảng Quản lí tài khoản (CCCD che).
 * @param userId  id tài khoản
 * @returns       tài khoản theo AccountSchema
 */
function toAccount(userId: string): Account {
  const { name, email, role, phone, cccd } = getProfile(userId);
  return { id: userId, name, email, role, phone, maskedCccd: maskCccd(cccd) };
}

/**
 * Lấy mọi tài khoản cho bảng Quản lí tài khoản.
 * @returns  các tài khoản, CCCD đã che
 */
export function getAccounts(): Account[] {
  return Object.keys(accounts).map(toAccount);
}

/**
 * Lấy CCCD đầy đủ của mọi tài khoản (cho nút "Hiện CCCD" ở Quản lí tài khoản).
 * @returns  CCCD theo id tài khoản; tài khoản chưa có CCCD thì không có mặt
 */
export function getAccountCccds(): Record<string, string> {
  return Object.fromEntries(Object.entries(accounts).flatMap(([id, account]) => (account.cccd ? [[id, account.cccd]] : [])));
}

/** Kết quả tạo / sửa tài khoản: thành công kèm tài khoản, hoặc mã HTTP và câu báo lỗi. */
export type AccountChange = { ok: true; account: Account } | { ok: false; status: number; message: string };

/**
 * Tạo tài khoản mới. Người dùng tự bổ sung thông tin khi đăng nhập lần đầu (chưa đánh dấu đã bổ sung).
 * @param input  dữ liệu đã kiểm tra (email đã đổi về chữ thường); cccd, phone rỗng = không có
 * @returns      tài khoản vừa tạo; email hoặc CCCD đã có tài khoản thì 409
 */
export function createAccount(input: CreateAccountRequest): AccountChange {
  if (isEmailTaken(input.email)) return { ok: false, status: 409, message: ACCOUNT_MESSAGES.emailTaken };
  if (input.cccd && isCccdTaken(input.cccd, '')) return { ok: false, status: 409, message: ACCOUNT_MESSAGES.cccdTaken };
  const userId = `tk-${Date.now()}`;
  putAccount(userId, {
    email: input.email,
    role: input.role,
    name: input.name,
    phone: input.phone || null,
    cccd: input.cccd || null,
    completed: false,
    mainStudentId: null,
  });
  return { ok: true, account: toAccount(userId) };
}

/**
 * Sửa họ tên, CCCD, SĐT, vai trò của một tài khoản. Email giữ nguyên.
 * Họ tên mới hiện ở mọi đơn người đó nộp, tiếp nhận, xử lí (đơn lưu id tài khoản, không chép họ tên).
 * @param userId  id tài khoản cần sửa
 * @param input   dữ liệu đã kiểm tra
 * @param editor  id người đang sửa: không được đổi vai trò của chính mình
 * @returns       tài khoản sau khi sửa; không có tài khoản thì 404, tự đổi vai trò 422, CCCD trùng 409
 */
export function updateAccount(userId: string, input: UpdateAccountRequest, editor: { id: string }): AccountChange {
  const account = accounts[userId];
  if (!account) return { ok: false, status: 404, message: ACCOUNT_MESSAGES[404] };
  if (userId === editor.id && input.role !== account.role) return { ok: false, status: 422, message: ACCOUNT_MESSAGES.ownRole };
  if (input.cccd && isCccdTaken(input.cccd, userId)) return { ok: false, status: 409, message: ACCOUNT_MESSAGES.cccdTaken };
  putAccount(userId, { ...account, name: input.name, cccd: input.cccd || null, phone: input.phone || null, role: input.role });
  return { ok: true, account: toAccount(userId) };
}

/* Các MSSV "lấy từ database trường" theo email (lấy từ artifact/js/auth.js và ST của sample-data.js), chỉ đọc nên không lưu lại.
   sv-1 và sv-5 có 2 MSSV (học thêm văn bằng 2), MSSV trùng email đứng đầu; sv-7 không có MSSV nào; các sinh viên khác 1 MSSV,
   có người thiếu vài mục (database trường không có). Cán bộ không có MSSV. */
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
  'sv-2': [
    {
      studentId: '2253801010012',
      className: '47-LTM-A',
      trainingMode: 'Chính quy',
      major: 'Luật Thương mại quốc tế',
      currentCohort: 'K47 (2022–2026)',
      originalCohort: 'K47 (2022–2026)',
    },
  ],
  'sv-3': [
    {
      studentId: '2353801020145',
      className: '48-QTL-B',
      trainingMode: 'Chính quy',
      major: 'Quản trị – Luật',
      currentCohort: 'K48 (2023–2027)',
      originalCohort: 'K48 (2023–2027)',
    },
  ],
  'sv-4': [
    {
      studentId: '2253801010388',
      className: '48-L-C',
      trainingMode: 'Chính quy',
      major: 'Luật',
      currentCohort: 'K48 (2023–2027)',
      originalCohort: 'K47 (2022–2026)',
    },
  ],
  'sv-5': [
    {
      studentId: '2053801010214',
      className: '45-L-B',
      trainingMode: 'Chính quy',
      major: 'Luật',
      currentCohort: 'K45 (2020–2024)',
      originalCohort: 'K45 (2020–2024)',
    },
    {
      studentId: '2323801040021',
      className: 'VB2-23A',
      trainingMode: 'Văn bằng 2',
      major: 'Luật',
      currentCohort: 'VB2 K23',
      originalCohort: 'VB2 K23',
    },
  ],
  'sv-6': [
    {
      studentId: '2453801010507',
      className: null,
      trainingMode: 'Chính quy',
      major: 'Luật',
      currentCohort: 'K49 (2024–2028)',
      originalCohort: 'K49 (2024–2028)',
    },
  ],
  'sv-8': [
    {
      studentId: '2153801030219',
      className: '47-LDS-A',
      trainingMode: 'Chính quy',
      major: 'Luật Dân sự',
      currentCohort: 'K47 (2022–2026)',
      originalCohort: 'K46 (2021–2025)',
    },
  ],
  'sv-9': [
    {
      studentId: '2453801010733',
      className: null,
      trainingMode: null,
      major: 'Luật',
      currentCohort: null,
      originalCohort: null,
    },
  ],
  'sv-10': [
    {
      studentId: '2353801020611',
      className: '48-LTM-B',
      trainingMode: 'Chính quy',
      major: 'Luật Thương mại quốc tế',
      currentCohort: 'K48 (2023–2027)',
      originalCohort: 'K48 (2023–2027)',
    },
  ],
  'sv-11': [
    {
      studentId: '2423801050042',
      className: 'LT-24A',
      trainingMode: 'Liên thông',
      major: 'Luật',
      currentCohort: 'Liên thông K24',
      originalCohort: 'Liên thông K24',
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

/* ---------- Loại đơn ---------- */

/* Loại đơn ban đầu.
   - Xét miễn môn: như TYPES.xmm trong artifact/js/config.js.
   - Đơn thử nghiệm: đủ 10 loại câu hỏi, để xem giao diện từng loại khi chưa có trình soạn loại đơn (bước 7).
   Cấu trúc khai báo dạng thô rồi cho qua FormTypeSchema, để điền sẵn giá trị mặc định (required, main…) như máy chủ. */
const FORM_TYPE_SEED: readonly FormType[] = [
  {
    id: 'xmm',
    name: 'Xét miễn môn',
    prefix: 'XMM',
    description: 'Miễn môn đã học tương đương ở cơ sở đào tạo khác',
    status: 'open',
    sections: [
      {
        id: 's-mon',
        title: 'Đăng ký miễn môn',
        main: true,
        hint: 'Mỗi dòng là một môn của trường bạn muốn xét miễn, kèm môn đã học tương đương ở cơ sở khác.',
        questions: [
          {
            id: 'mon',
            tag: 'mon',
            type: 'table',
            label: 'Các môn xin miễn',
            required: true,
            rowName: 'môn',
            columns: [
              { label: 'Môn học của trường', sub: 'Môn muốn xét miễn', type: 'text', placeholder: 'VD: Luật Hiến pháp' },
              { label: 'Số tín chỉ', type: 'number', placeholder: 'TC', sum: true, sumLabel: 'tín chỉ' },
              { label: 'Môn học tương đương', sub: 'Môn dùng để xét miễn', type: 'text', placeholder: 'Tên môn đã học' },
              { label: 'Cơ sở đào tạo', sub: 'Nơi dạy môn tương đương', type: 'text', placeholder: 'Tên trường / cơ sở' },
            ],
          },
        ],
      },
      {
        id: 's-files',
        title: 'Bảng điểm minh chứng',
        hint: 'Tải lên bảng điểm có xác nhận của cơ sở đào tạo cũ.',
        questions: [
          {
            id: 'files',
            tag: 'tep_bang_diem',
            type: 'file',
            label: 'Tệp bảng điểm',
            required: true,
            accept: ['pdf', 'jpg', 'png'],
            maxMB: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'thu',
    name: 'Đơn thử nghiệm (đủ loại câu hỏi)',
    prefix: 'THU',
    description: 'Có đủ 10 loại câu hỏi, để xem giao diện của từng loại',
    status: 'open',
    sections: [
      {
        id: 's-chu',
        title: 'Chữ, số và ngày',
        main: true,
        hint: 'Câu có dấu * là bắt buộc. Bấm Gửi đơn khi còn trống để xem câu báo lỗi.',
        questions: [
          {
            id: 'info-dau',
            type: 'info',
            content: {
              type: 'doc',
              content: [
                { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Lưu ý' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Đây là khối thông báo: không cần trả lời.' }] },
                {
                  type: 'bulletList',
                  content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nội dung có thể ' }, { type: 'text', text: 'in đậm', marks: [{ type: 'bold' }] }, { type: 'text', text: ' hoặc gạch đầu dòng.' }] }] },
                  ],
                },
              ],
            },
          },
          { id: 'tieu-de', type: 'text', label: 'Tiêu đề đơn', required: true, help: 'Trả lời ngắn: không xuống dòng bằng Enter.' },
          { id: 'li-do', type: 'para', label: 'Lí do', help: 'Đoạn văn, viết được nhiều dòng.' },
          { id: 'so-tin-chi', type: 'number', label: 'Số tín chỉ đã tích lũy', required: true },
          { id: 'ngay-nghi', type: 'date', label: 'Ngày bắt đầu nghỉ học' },
        ],
      },
      {
        id: 's-chon',
        title: 'Lựa chọn',
        questions: [
          { id: 'hoc-ky', type: 'radio', label: 'Học kỳ đăng ký', required: true, options: ['Học kỳ 1', 'Học kỳ 2', 'Học kỳ hè'] },
          {
            id: 'giay-to',
            type: 'check',
            label: 'Giấy tờ đã có',
            required: true,
            help: 'Chọn một hoặc nhiều mục.',
            options: ['Bảng điểm', 'Giấy xác nhận sinh viên', 'Đơn có chữ ký phụ huynh'],
          },
          {
            id: 'co-so',
            type: 'select',
            label: 'Cơ sở học',
            options: ['Cơ sở Nguyễn Tất Thành', 'Cơ sở Bình Thạnh', 'Cơ sở Thủ Đức'],
          },
        ],
      },
      {
        id: 's-bang',
        title: 'Bảng và tệp',
        questions: [
          {
            id: 'mon-hoc',
            type: 'table',
            label: 'Các môn đã đăng ký',
            help: 'Không bắt buộc: để trống bảng cũng được.',
            rowName: 'môn',
            columns: [
              { label: 'Tên môn', type: 'text', placeholder: 'VD: Luật Dân sự' },
              { label: 'Số tín chỉ', type: 'number', placeholder: 'TC', sum: true, sumLabel: 'tín chỉ' },
              { label: 'Ghi chú', sub: 'Lớp, giảng viên…', type: 'text' },
            ],
          },
          { id: 'tep-dinh-kem', type: 'file', label: 'Tệp đính kèm', accept: ['pdf', 'docx'], maxMB: 5 },
        ],
      },
    ],
  },
  ...[
    ['nhs', 'Xin nghỉ học tạm thời', 'closed'],
    ['blk', 'Xin bảo lưu kết quả học tập', 'closed'],
    ['pkd', 'Phúc khảo điểm thi', 'closed'],
    ['cnh', 'Xin chuyển ngành', 'closed'],
    ['cbd', 'Xin cấp bảng điểm', 'closed'],
    ['xnsv', 'Xin giấy xác nhận sinh viên', 'closed'],
    ['hth', 'Xin hoãn thi', 'draft'],
    ['hv', 'Xin học vượt', 'draft'],
    ['hl', 'Đăng ký học lại', 'draft'],
    ['cltsv', 'Xin cấp lại thẻ sinh viên', 'draft'],
  ].map(([id, name, status]) => ({
    id,
    name,
    prefix: id!.toUpperCase(),
    description: `${name} (loại đơn mẫu để thử giao diện)`,
    status,
    sections: [
      {
        id: 's-chung',
        title: 'Thông tin đơn',
        main: true,
        questions: [{ id: 'li-do', type: 'para', label: 'Lí do', required: true }],
      },
    ],
  })),
].map((rawFormType) => FormTypeSchema.parse(rawFormType));

/** Một phiên bản loại đơn trong API giả: nội dung, trạng thái, lần lưu gần nhất (id cán bộ). */
interface MockFormTypeVersion {
  version: number;
  status: FormTypeStatus;
  name: string;
  description: string | null;
  sections: FormSection[];
  updatedAt: string;
  updatedById: string;
}

/** Một loại đơn trong API giả: mã loại đơn, mã đơn, các phiên bản (cũ trước, mới sau). */
interface MockFormType {
  id: string;
  prefix: string;
  versions: MockFormTypeVersion[];
}

/**
 * Lần lưu gần nhất của loại đơn mẫu thứ i (như updatedAt, updatedBy của TYPES trong config.js):
 * Xét miễn môn như bản mẫu; các loại khác lùi dần mỗi loại 6 ngày, giờ lưu trong giờ hành chính, lần lượt 3 cán bộ mẫu.
 * @param i  vị trí trong FORM_TYPE_SEED
 * @returns  lúc lưu, id cán bộ lưu
 */
function seedUpdate(i: number): { updatedAt: string; updatedById: string } {
  if (i === 0) return { updatedAt: '2026-09-01T08:00', updatedById: 'cb-1' };
  return {
    updatedAt: `${addHours('2026-11-05T00:00', -(i - 1) * 144).slice(0, 10)}T${String(8 + ((i * 3) % 9)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`,
    updatedById: `cb-${((i - 1) % 3) + 1}`,
  };
}

/**
 * Dựng các loại đơn ban đầu, mỗi loại một phiên bản (phiên bản 1) theo FORM_TYPE_SEED.
 * Riêng đơn thử nghiệm có thêm phiên bản 1 cũ (Đã đóng, chỉ có phần đầu), để thấy cách hiện nhiều phiên bản.
 * @returns  các loại đơn
 */
function seedFormTypes(): MockFormType[] {
  return FORM_TYPE_SEED.map((formType, i) => {
    const { id, prefix, name, description, status, sections } = structuredClone(formType);
    const latest: MockFormTypeVersion = { version: 1, status, name, description, sections, ...seedUpdate(i) };
    if (id !== 'thu') return { id, prefix, versions: [latest] };
    const firstVersion: MockFormTypeVersion = {
      ...structuredClone(latest),
      status: 'closed',
      sections: structuredClone(sections.slice(0, 1)),
      updatedAt: '2026-08-14T09:30',
      updatedById: 'cb-2',
    };
    return { id, prefix, versions: [firstVersion, { ...latest, version: 2 }] };
  });
}

/** Các loại đơn hiện có (trình soạn tạo, sửa, xóa được); tải lại trang thì về ban đầu. */
let FORM_TYPES: MockFormType[] = seedFormTypes();

/** Mã đơn khóa khi đã có phiên bản từng được mở (Đang mở hoặc Đã đóng). */
const isPrefixLocked = (formType: MockFormType) => formType.versions.some((version) => version.status !== 'draft');
/** Phiên bản mới nhất. */
const latestVersion = (formType: MockFormType) => formType.versions[formType.versions.length - 1]!;
/** Phiên bản đang mở; không có thì undefined. */
const openVersion = (formType: MockFormType) => formType.versions.find((version) => version.status === 'open');
/** Tìm loại đơn theo mã. */
const findFormType = (formTypeId: string) => FORM_TYPES.find((formType) => formType.id === formTypeId);

/**
 * Đổi phiên bản trong API giả sang dạng gửi cho trình soạn (cán bộ lưu: id → tên).
 * @param version  phiên bản
 * @returns        phiên bản kèm cán bộ lưu
 */
function toVersion({ updatedById, ...version }: MockFormTypeVersion): FormTypeVersion {
  return { ...structuredClone(version), updatedBy: staffOf(updatedById)! };
}

/**
 * Loại đơn kèm mọi phiên bản, cho trình soạn.
 * @param formTypeId  mã loại đơn
 * @returns           loại đơn (phiên bản mới nhất trước); không có thì null
 */
export function getManagedFormType(formTypeId: string): ManagedFormType | null {
  const formType = findFormType(formTypeId);
  if (!formType) return null;
  return {
    id: formType.id,
    prefix: formType.prefix,
    prefixLocked: isPrefixLocked(formType),
    formCount: countFormsOfType(formType.id),
    versions: formType.versions.map(toVersion).reverse(),
  };
}

/**
 * Mọi loại đơn cho bảng Quản lí loại đơn: mỗi loại một dòng theo phiên bản mới nhất, kèm các phiên bản cũ hơn.
 * @returns  các dòng của bảng
 */
export function getFormTypeSummaries(): FormTypeSummary[] {
  return FORM_TYPES.map((formType) => {
    const [latest, ...olderVersions] = formType.versions.map(toVersion).reverse();
    const { version, status, name, description, updatedAt, updatedBy } = latest!;
    return {
      id: formType.id,
      prefix: formType.prefix,
      name,
      description,
      version,
      status,
      updatedAt,
      updatedBy,
      formCount: countFormsOfType(formType.id),
      olderVersions: olderVersions.map(({ sections: _sections, description: _description, ...summary }) => summary),
    };
  });
}

/**
 * Đếm đơn đã nộp theo một loại đơn (mọi phiên bản).
 * @param formTypeId  mã loại đơn
 * @returns           số đơn
 */
export function countFormsOfType(formTypeId: string): number {
  return FORMS.filter((form) => form.formTypeId === formTypeId).length;
}

/**
 * Mã đơn của các loại đơn khác, để báo trùng.
 * @param exceptFormTypeId  loại đơn đang lưu (không tính); tạo mới thì null
 * @returns                 các mã đơn
 */
export function otherFormTypePrefixes(exceptFormTypeId: string | null): string[] {
  return FORM_TYPES.filter((formType) => formType.id !== exceptFormTypeId).map((formType) => formType.prefix);
}

/**
 * Đặt trạng thái cho một phiên bản; mở thì phiên bản đang mở khác tự chuyển sang Đã đóng.
 * @param formType  loại đơn
 * @param target    phiên bản cần đặt
 * @param status    trạng thái mới
 */
function applyVersionStatus(formType: MockFormType, target: MockFormTypeVersion, status: FormTypeStatus): void {
  if (status === 'open') {
    formType.versions.forEach((version) => {
      if (version !== target && version.status === 'open') version.status = 'closed';
    });
  }
  target.status = status;
}

/**
 * Dựng một phiên bản từ bản soạn gửi lên.
 * @param version  số phiên bản
 * @param input    bản soạn (trạng thái chưa đặt, gọi applyVersionStatus sau)
 * @param staffId  cán bộ lưu
 * @returns        phiên bản ở trạng thái Nháp
 */
function versionFromInput(version: number, input: SaveFormTypeVersionRequest, staffId: string): MockFormTypeVersion {
  return {
    version,
    status: 'draft',
    name: input.name,
    description: input.description,
    sections: structuredClone(input.sections),
    updatedAt: vietnamNow(),
    updatedById: staffId,
  };
}

/**
 * Tạo loại đơn với phiên bản 1. Mã loại đơn lấy theo mã đơn viết thường (trùng thì thêm số), như bản mẫu.
 * Bản soạn đã được kiểm tra trước (validateFormTypeDraft).
 * @param input    bản soạn
 * @param staffId  cán bộ tạo
 * @returns        loại đơn vừa tạo kèm phiên bản
 */
export function createFormType(input: SaveFormTypeVersionRequest, staffId: string): ManagedFormType {
  const baseId = input.prefix.toLowerCase();
  let id = baseId;
  for (let n = 2; findFormType(id); n += 1) id = `${baseId}-${n}`;
  const formType: MockFormType = { id, prefix: input.prefix, versions: [versionFromInput(1, input, staffId)] };
  applyVersionStatus(formType, formType.versions[0]!, input.status);
  FORM_TYPES.push(formType);
  return getManagedFormType(id)!;
}

/** Kết quả một lệnh sửa loại đơn: thành công kèm loại đơn sau khi sửa, hoặc lỗi (mã HTTP + câu báo). */
export type FormTypeChange = { ok: true; formType: ManagedFormType } | { ok: false; status: number; message: string };

/**
 * Thêm phiên bản mới (Nháp hoặc mở luôn). Không được khi đang có phiên bản Nháp. Mã đơn đã khóa thì giữ nguyên.
 * @param formTypeId  mã loại đơn
 * @param input       bản soạn đã kiểm tra
 * @param staffId     cán bộ lưu
 * @returns           kết quả
 */
export function addFormTypeVersion(formTypeId: string, input: SaveFormTypeVersionRequest, staffId: string): FormTypeChange {
  const formType = findFormType(formTypeId);
  if (!formType) return { ok: false, status: 404, message: FORM_TYPE_MESSAGES.notFound };
  const draftVersion = formType.versions.find((version) => version.status === 'draft');
  if (draftVersion) return { ok: false, status: 409, message: FORM_TYPE_MESSAGES.draftExists(draftVersion.version) };
  if (input.prefix !== formType.prefix && isPrefixLocked(formType)) return { ok: false, status: 409, message: FORM_TYPE_MESSAGES.prefixLocked };

  const added = versionFromInput(latestVersion(formType).version + 1, input, staffId);
  formType.versions.push(added);
  applyVersionStatus(formType, added, input.status);
  formType.prefix = input.prefix;
  return { ok: true, formType: getManagedFormType(formTypeId)! };
}

/**
 * Lưu phiên bản Nháp (nội dung, và mở luôn nếu chọn Đang mở). Phiên bản đã khóa thì không sửa được.
 * @param formTypeId  mã loại đơn
 * @param version     số phiên bản
 * @param input       bản soạn đã kiểm tra
 * @param staffId     cán bộ lưu
 * @returns           kết quả
 */
export function saveFormTypeVersion(formTypeId: string, version: number, input: SaveFormTypeVersionRequest, staffId: string): FormTypeChange {
  const formType = findFormType(formTypeId);
  if (!formType) return { ok: false, status: 404, message: FORM_TYPE_MESSAGES.notFound };
  const index = formType.versions.findIndex((candidate) => candidate.version === version);
  if (index < 0) return { ok: false, status: 404, message: FORM_TYPE_MESSAGES.versionNotFound };
  if (formType.versions[index]!.status !== 'draft') return { ok: false, status: 409, message: FORM_TYPE_MESSAGES.versionLocked };
  if (input.prefix !== formType.prefix && isPrefixLocked(formType)) return { ok: false, status: 409, message: FORM_TYPE_MESSAGES.prefixLocked };

  const saved = versionFromInput(version, input, staffId);
  formType.versions[index] = saved;
  applyVersionStatus(formType, saved, input.status);
  formType.prefix = input.prefix;
  return { ok: true, formType: getManagedFormType(formTypeId)! };
}

/**
 * Mở / đóng phiên bản đã khóa (lưu lại lúc đổi và người đổi).
 * @param formTypeId  mã loại đơn
 * @param version     số phiên bản
 * @param status      Đang mở hoặc Đã đóng
 * @param staffId     cán bộ đổi
 * @returns           kết quả
 */
export function setFormTypeVersionStatus(formTypeId: string, version: number, status: 'open' | 'closed', staffId: string): FormTypeChange {
  const formType = findFormType(formTypeId);
  if (!formType) return { ok: false, status: 404, message: FORM_TYPE_MESSAGES.notFound };
  const target = formType.versions.find((candidate) => candidate.version === version);
  if (!target) return { ok: false, status: 404, message: FORM_TYPE_MESSAGES.versionNotFound };
  if (target.status === 'draft') return { ok: false, status: 409, message: FORM_TYPE_MESSAGES.draftNotLocked };

  applyVersionStatus(formType, target, status);
  target.updatedAt = vietnamNow();
  target.updatedById = staffId;
  return { ok: true, formType: getManagedFormType(formTypeId)! };
}

/**
 * Xóa phiên bản Nháp; nếu đó là phiên bản duy nhất thì xóa luôn loại đơn.
 * @param formTypeId  mã loại đơn
 * @param version     số phiên bản
 * @returns           kết quả; xóa luôn loại đơn thì formType = null
 */
export function deleteFormTypeVersion(
  formTypeId: string,
  version: number,
): { ok: true; formType: ManagedFormType | null } | { ok: false; status: number; message: string } {
  const formType = findFormType(formTypeId);
  if (!formType) return { ok: false, status: 404, message: FORM_TYPE_MESSAGES.notFound };
  const target = formType.versions.find((candidate) => candidate.version === version);
  if (!target) return { ok: false, status: 404, message: FORM_TYPE_MESSAGES.versionNotFound };
  if (target.status !== 'draft') return { ok: false, status: 409, message: FORM_TYPE_MESSAGES.onlyDraftDeletable };

  if (formType.versions.length === 1) {
    FORM_TYPES = FORM_TYPES.filter((candidate) => candidate !== formType);
    return { ok: true, formType: null };
  }
  formType.versions = formType.versions.filter((candidate) => candidate !== target);
  return { ok: true, formType: getManagedFormType(formTypeId) };
}

/**
 * Các loại đơn đang nhận đơn (có phiên bản Đang mở), theo tên của phiên bản đang mở.
 * @returns  loại đơn, chưa có cấu trúc các phần; không có thì []
 */
export function getOpenFormTypes(): OpenFormType[] {
  return FORM_TYPES.flatMap((formType) => {
    const opened = openVersion(formType);
    return opened ? [{ id: formType.id, name: opened.name, prefix: formType.prefix, description: opened.description }] : [];
  });
}

/**
 * Phiên bản đang mở của một loại đơn, đủ cấu trúc các phần, câu hỏi (để nộp đơn).
 * @param formTypeId  mã loại đơn, vd 'xmm'
 * @returns           phiên bản đang mở; loại đơn không có, hoặc không có phiên bản nào đang mở, thì null
 */
export function getFormType(formTypeId: string): FormType | null {
  const formType = findFormType(formTypeId);
  const opened = formType && openVersion(formType);
  if (!formType || !opened) return null;
  const { version, status, name, description, sections } = structuredClone(opened);
  return { id: formType.id, prefix: formType.prefix, name, description, version, status, sections };
}

/* ---------- Lá đơn ---------- */

/** Thêm số 0 phía trước cho đủ 2 chữ số, vd 7 → "07". */
const twoDigits = (number: number) => String(number).padStart(2, '0');

/** Ngày dạng 'YYYY-MM-DD' theo giờ máy. */
const dateText = (day: Date) => `${day.getFullYear()}-${twoDigits(day.getMonth() + 1)}-${twoDigits(day.getDate())}`;

/**
 * Cộng thêm số giờ vào một thời điểm (như addHours của bản mẫu), không phụ thuộc múi giờ của máy.
 * @param dateTime  thời điểm 'YYYY-MM-DDTHH:mm'
 * @param hours     số giờ cộng thêm
 * @returns         thời điểm mới cùng dạng, vd ('2026-10-30T07:00', 27) → '2026-10-31T10:00'
 */
function addHours(dateTime: string, hours: number): string {
  return new Date(Date.parse(`${dateTime}:00Z`) + hours * 3_600_000).toISOString().slice(0, 16);
}

/** Lá đơn trong API giả: dòng tóm tắt, kèm id người nộp, cán bộ, các mốc thời gian, nội dung và bản chụp loại đơn lúc nộp. */
interface MockForm extends FormSummary {
  ownerId: string;
  /** Lúc Duyệt / Từ chối gần nhất (mã {ngay_xu_li} khi xuất file); đơn mẫu không có thì lấy lần lưu gần nhất */
  decidedAt?: string | null;
  updatedAt: string;
  note: string;
  receiverId: string | null;
  receivedAt: string | null;
  handlerId: string | null;
  handlerSince: string | null;
  answers: FormAnswers;
  formTypeSnapshot: FormType;
}

/** Lá đơn mẫu chưa gán cán bộ. */
type UnassignedForm = Omit<MockForm, 'receiverId' | 'handlerId' | 'handlerSince'>;

/* 3 cán bộ tiếp nhận / xử lí các đơn mẫu, như SAMPLE_STAFF trong artifact/js/sample-data.js. */
const SEED_STAFF_IDS = ['cb-1', 'cb-2', 'cb-3'] as const;

/* 10 sinh viên khác có đơn mẫu (tài khoản sv-2 … sv-11). */
const OTHER_STUDENT_IDS = Array.from({ length: 10 }, (_, i) => `sv-${i + 2}`);

/* Các môn mẫu cho bảng "Các môn xin miễn": [môn của trường, số tín chỉ, môn tương đương, cơ sở đào tạo] (như P trong sample-data.js). */
const SAMPLE_SUBJECTS: TableCell[][] = [
  ['Triết học Mác – Lênin', 3, 'Triết học Mác – Lênin', 'ĐH KHXH&NV – ĐHQG TP.HCM'],
  ['Kinh tế chính trị Mác – Lênin', 2, 'Kinh tế chính trị Mác – Lênin', 'ĐH Kinh tế TP.HCM'],
  ['Chủ nghĩa xã hội khoa học', 2, 'Chủ nghĩa xã hội khoa học', 'ĐH Sư phạm TP.HCM'],
  ['Lịch sử Đảng Cộng sản Việt Nam', 2, 'Lịch sử Đảng Cộng sản Việt Nam', 'ĐH Công nghiệp TP.HCM'],
  ['Tư tưởng Hồ Chí Minh', 2, 'Tư tưởng Hồ Chí Minh', 'ĐH Mở TP.HCM'],
  ['Tiếng Anh pháp lý 1', 3, 'English for Specific Purposes 1', 'ĐH Sư phạm TP.HCM'],
  ['Tin học đại cương', 2, 'Tin học căn bản', 'ĐH Bách khoa – ĐHQG TP.HCM'],
  ['Logic học', 2, 'Logic học đại cương', 'ĐH KHXH&NV – ĐHQG TP.HCM'],
  ['Xã hội học pháp luật', 2, 'Xã hội học đại cương', 'ĐH Mở TP.HCM'],
  ['Kinh tế vi mô', 3, 'Microeconomics', 'ĐH Kinh tế – Luật'],
  ['Giáo dục thể chất 1', 1, 'Giáo dục thể chất 1', 'ĐH Nông Lâm TP.HCM'],
];

/* Lí do mẫu Phòng Đào tạo ghi khi Yêu cầu bổ sung / Từ chối (như N trong sample-data.js); trạng thái khác không có lí do. */
/** Tiền tố id của tệp mẫu có sẵn trong đơn mẫu; sau tiền tố là mã đơn chứa tệp. */
const SEED_FILE_ID_PREFIX = 'seed-';

const SUPPLEMENT_NOTE = 'Bảng điểm chưa có dấu xác nhận của cơ sở đào tạo. Vui lòng nộp lại bản có xác nhận.';
const SAMPLE_NOTES: Partial<Record<FormStatus, string>> = {
  bs: SUPPLEMENT_NOTE,
  bsg: SUPPLEMENT_NOTE,
  tc: 'Nội dung môn tương đương trùng dưới 70% đề cương môn của trường.',
};

/**
 * Câu trả lời mẫu của một đơn Xét miễn môn: bảng môn và một tệp bảng điểm (tệp mẫu không có nội dung thật).
 * @param code      mã đơn, để đặt id tệp
 * @param subjects  các dòng bảng môn
 * @param fileName  tên tệp bảng điểm
 * @returns         câu trả lời theo id câu hỏi của loại đơn xmm
 */
function sampleAnswers(code: string, subjects: TableCell[][], fileName: string): FormAnswers {
  const sizeBytes = 150_000 + (Number(code.slice(-5)) * 7_919) % 900_000;
  return { mon: subjects.map((row) => [...row]), files: [{ id: `${SEED_FILE_ID_PREFIX}${code}`, name: fileName, sizeBytes }] };
}

/** Bản chụp loại đơn Xét miễn môn cho đơn mẫu. */
const xmmSnapshot = () => structuredClone(FORM_TYPE_SEED.find((formType) => formType.id === 'xmm')!);

/**
 * Sinh 18 đơn Xét miễn môn mẫu cho sinh viên đăng nhập thử, như hàm seed() trong artifact/js/sample-data.js
 * (cùng trạng thái, mã đơn, ngày nộp, các môn, tệp, lí do), để bảng có nhiều trang, đủ các trạng thái.
 * @returns  các đơn của sv-1, đơn mới nộp đứng đầu
 */
function seedStudentForms(): UnassignedForm[] {
  const statuses: FormStatus[] = [
    'nop', 'xet', 'xet', 'bs', 'duyet', 'xet', 'duyet', 'tc', 'duyet',
    'bsg', 'duyet', 'duyet', 'tc', 'duyet', 'duyet', 'tc', 'duyet', 'duyet',
  ];
  let day = new Date(2026, 9, 30);

  return statuses.map((status, i) => {
    // Ngày nộp lùi dần, giờ nộp trong buổi sáng; cứ 4 đơn có 1 đơn sửa lại buổi chiều cùng ngày
    const date = dateText(day);
    const code = formatFormCode('XMM', day.getFullYear(), 1, 1520 - i * 83);
    const submittedAt = `${date}T${twoDigits(7 + (i % 4))}:${twoDigits((i * 17) % 60)}`;
    const updatedAt = i % 4 === 1 ? `${date}T${twoDigits(13 + (i % 5))}:${twoDigits((i * 29) % 60)}` : submittedAt;

    // 1–3 môn, một tệp bảng điểm
    const subjects = Array.from({ length: 1 + ((i * 7) % 3) }, (_, k) => SAMPLE_SUBJECTS[(i * 3 + k * 5) % SAMPLE_SUBJECTS.length]!);
    const fileName = `Bang_diem_${i % 2 ? 'hoc_ky' : 'toan_khoa'}_${i + 1}.pdf`;

    day = new Date(day.getTime() - (9 + ((i * 13) % 17)) * 86_400_000);
    return {
      ownerId: 'sv-1',
      code,
      formTypeId: 'xmm',
      formTypeName: 'Xét miễn môn',
      submittedAt,
      updatedAt,
      status,
      note: SAMPLE_NOTES[status] ?? '',
      receivedAt: status === 'nop' ? null : addHours(submittedAt, 3 + (i % 3) * 18),
      answers: sampleAnswers(code, subjects, fileName),
      formTypeSnapshot: xmmSnapshot(),
    };
  });
}

/**
 * Sinh đơn của 10 sinh viên khác (sv-2 … sv-11), như hàm seedOthers() trong artifact/js/sample-data.js:
 * sinh viên thứ i có 1 + i % 3 đơn, tổng 19 đơn, mỗi đơn một môn. Dùng cho mục "Đơn phụ trách" của cán bộ.
 * @returns  các đơn
 */
function seedOtherStudentForms(): UnassignedForm[] {
  const statuses: FormStatus[] = ['nop', 'xet', 'bs', 'duyet', 'tc', 'bsg', 'xet', 'duyet'];
  const subjects = [0, 5, 6, 9, 7].map((index) => SAMPLE_SUBJECTS[index]!);
  const forms: UnassignedForm[] = [];
  let formIndex = 0;

  for (let student = 0; student < OTHER_STUDENT_IDS.length; student++) {
    for (let j = 0; j < 1 + (student % 3); j++, formIndex++) {
      // Ngày nộp rải trong khoảng 200 ngày; đơn Đã bổ sung sửa sau 30 giờ, vài đơn khác sửa sau 5 giờ
      const day = new Date(2026, 9, 31 - ((formIndex * 11) % 200));
      const code = formatFormCode('XMM', day.getFullYear(), 1, 1500 - formIndex * 37);
      const submittedAt = `${dateText(day)}T${twoDigits(8 + (formIndex % 9))}:${twoDigits((formIndex * 13) % 60)}`;
      const status = statuses[formIndex % statuses.length]!;
      const updatedAt = status === 'bsg' ? addHours(submittedAt, 30) : formIndex % 5 === 2 ? addHours(submittedAt, 5) : submittedAt;

      forms.push({
        ownerId: OTHER_STUDENT_IDS[student]!,
        code,
        formTypeId: 'xmm',
        formTypeName: 'Xét miễn môn',
        submittedAt,
        updatedAt,
        status,
        note: SAMPLE_NOTES[status] ?? '',
        receivedAt: status === 'nop' ? null : addHours(submittedAt, 3 + (formIndex % 3) * 18),
        answers: sampleAnswers(code, [subjects[formIndex % subjects.length]!], `Bang_diem_${formIndex + 1}.pdf`),
        formTypeSnapshot: xmmSnapshot(),
      });
    }
  }
  return forms;
}

/**
 * Gán người tiếp nhận, người xử lí cho các đơn, như đoạn cuối artifact/js/sample-data.js:
 * đơn Đã nộp chưa ai tiếp nhận; đơn khác do lần lượt 3 cán bộ tiếp nhận,
 * cứ 5 đơn có 1 đơn đã chuyển giao cho người kế tiếp (26 giờ sau khi tiếp nhận).
 * @param forms  các đơn chưa gán
 * @returns      các đơn đã gán cán bộ
 */
function assignStaff(forms: UnassignedForm[]): MockForm[] {
  return forms.map((form, i) => {
    if (!form.receivedAt) return { ...form, receiverId: null, handlerId: null, handlerSince: null };
    const receiverId = SEED_STAFF_IDS[i % SEED_STAFF_IDS.length]!;
    const transferred = i % 5 === 2;
    return {
      ...form,
      receiverId,
      handlerId: transferred ? SEED_STAFF_IDS[(i + 1) % SEED_STAFF_IDS.length]! : receiverId,
      handlerSince: transferred ? addHours(form.receivedAt, 26) : form.receivedAt,
    };
  });
}

/* Mọi lá đơn, đơn mới nộp đứng đầu. */
let FORMS: MockForm[] = seedForms();

/**
 * Dựng lại toàn bộ đơn mẫu.
 * @returns  đơn của sinh viên đăng nhập thử rồi đơn của sinh viên khác, đã gán cán bộ
 */
function seedForms(): MockForm[] {
  return assignStaff([...seedStudentForms(), ...seedOtherStudentForms()]);
}

/**
 * Chỉ giữ phần trả về cho bảng đơn (bỏ id nội bộ, câu trả lời, bản chụp loại đơn).
 * @param form  lá đơn trong API giả
 * @returns     dòng tóm tắt theo FormSummarySchema
 */
function toSummary({ code, formTypeId, formTypeName, submittedAt, status }: MockForm): FormSummary {
  return { code, formTypeId, formTypeName, submittedAt, status };
}

/**
 * Tên, email hiện tại của một tài khoản (người nộp, người tiếp nhận, người xử lí của đơn; người lưu loại đơn).
 * Đơn chỉ lưu id, nên đổi họ tên tài khoản thì tên mới hiện ở mọi nơi.
 * @param userId  id tài khoản
 * @returns       id, họ tên, email; không có tài khoản thì họ tên là id, email rỗng
 */
function personRef(userId: string): ApplicantRef {
  const account = accounts[userId];
  return account ? { id: userId, name: account.name, email: account.email } : { id: userId, name: userId, email: '' };
}

/**
 * Tìm cán bộ theo id.
 * @param staffId  id tài khoản cán bộ; null = chưa có
 * @returns        cán bộ; null nếu chưa có
 */
function staffOf(staffId: string | null): StaffRef | null {
  return staffId ? personRef(staffId) : null;
}

/** Một người dùng trong API giả: họ tên, email, vai trò, SĐT và CCCD (null = chưa có), các MSSV. */
export interface MockPerson {
  name: string;
  email: string;
  role: RoleId;
  phone: string | null;
  cccd: string | null;
  students: StudentInfo[];
  mainStudentId: string | null;
}

/**
 * Tìm một người dùng theo id.
 * @param userId  id người dùng
 * @returns       thông tin người dùng; không có thì null
 */
export function findPerson(userId: string): MockPerson | null {
  const account = accounts[userId];
  if (!account) return null;
  const { name, email, role, phone, cccd, mainStudentId } = account;
  return { name, email, role, phone, cccd, students: getStudents(userId), mainStudentId };
}

/**
 * Lấy các đơn một tài khoản đã nộp.
 * @param userId  id tài khoản
 * @returns       các đơn; chưa nộp đơn nào thì []
 */
export function getFormsOf(userId: string): FormSummary[] {
  return FORMS.filter((form) => form.ownerId === userId).map(toSummary);
}

/**
 * Lấy các đơn một cán bộ đã tiếp nhận hoặc đang xử lí.
 * @param staffId  id tài khoản cán bộ
 * @returns        các đơn kèm người tiếp nhận, người xử lí; không có thì []
 */
export function getFormsHandledBy(staffId: string): HandledFormSummary[] {
  return FORMS.filter((form) => form.receiverId === staffId || form.handlerId === staffId).map((form) => ({
    ...toSummary(form),
    receiver: staffOf(form.receiverId),
    handler: staffOf(form.handlerId),
  }));
}

/**
 * Lấy mọi đơn của mọi người nộp, cho bảng Quản lí đơn.
 * @returns  các đơn kèm lúc tiếp nhận và người nộp (SĐT, CCCD che; chưa có thì null)
 */
export function getAllForms(): ManagedFormSummary[] {
  return FORMS.map((form) => {
    const person = findPerson(form.ownerId);
    const applicant = personRef(form.ownerId);
    return {
      ...toSummary(form),
      receivedAt: form.receivedAt,
      applicant: { ...applicant, phone: person?.phone ?? null, maskedCccd: maskCccd(person?.cccd ?? null) },
    };
  });
}

/**
 * Đếm đơn theo trạng thái và theo loại đơn (hai khung thống kê của Quản lí đơn), trên tất cả đơn.
 * @returns  tổng số đơn, số đơn mỗi trạng thái (đủ 6 trạng thái) và số đơn mỗi loại đơn (nhiều nhất trước, bằng nhau thì theo tên)
 */
export function getFormStats(): FormStats {
  const byStatus = Object.fromEntries(FORM_STATUSES.map((status) => [status, 0])) as FormStats['byStatus'];
  const countByType = new Map<string, number>();
  for (const form of FORMS) {
    byStatus[form.status] += 1;
    countByType.set(form.formTypeId, (countByType.get(form.formTypeId) ?? 0) + 1);
  }
  // Tên, trạng thái theo phiên bản mới nhất, như dòng của bảng Quản lí loại đơn
  const byType = FORM_TYPES.map((formType) => ({
    formTypeId: formType.id,
    formTypeName: latestVersion(formType).name,
    formTypeStatus: latestVersion(formType).status,
    count: countByType.get(formType.id) ?? 0,
  })).sort((a, b) => b.count - a.count || a.formTypeName.localeCompare(b.formTypeName, 'vi'));
  return { total: FORMS.length, byStatus, byType };
}

/**
 * Lấy CCCD đầy đủ của những người đã nộp đơn (cho nút "Hiện CCCD").
 * @returns  CCCD theo id người nộp; người chưa có CCCD thì không có mặt
 */
export function getApplicantCccds(): Record<string, string> {
  const cccds: Record<string, string> = {};
  for (const form of FORMS) {
    const cccd = findPerson(form.ownerId)?.cccd;
    if (cccd) cccds[form.ownerId] = cccd;
  }
  return cccds;
}

/**
 * Một lá đơn đủ nội dung, nếu người hỏi được xem: là người nộp, hoặc được xem mọi đơn.
 * @param code        mã đơn
 * @param viewer      id và vai trò người đang đăng nhập
 * @returns           lá đơn theo FormDetailSchema; không có, hoặc không được xem, thì null
 */
export function getFormDetail(code: string, viewer: { id: string; role: RoleId }): FormDetail | null {
  const form = FORMS.find((candidate) => candidate.code === code);
  if (!form || (form.ownerId !== viewer.id && !can(viewer.role, 'viewAll'))) return null;
  return toDetail(form);
}

/**
 * Ghép thông tin người nộp, cán bộ và nội dung của một lá đơn (bản sao, sửa không ảnh hưởng dữ liệu giả).
 * @param form  lá đơn trong API giả
 * @returns     lá đơn theo FormDetailSchema
 */
function toDetail(form: MockForm): FormDetail {
  return {
    ...toSummary(form),
    updatedAt: form.updatedAt,
    note: form.note,
    applicant: personRef(form.ownerId),
    receiver: staffOf(form.receiverId),
    receivedAt: form.receivedAt,
    handler: staffOf(form.handlerId),
    handlerSince: form.handlerSince,
    sections: structuredClone(form.formTypeSnapshot.sections),
    answers: structuredClone(form.answers),
  };
}

/**
 * Thời điểm hiện tại theo giờ Việt Nam (UTC+7), không phụ thuộc múi giờ của máy.
 * @returns  vd '2026-11-10T16:05'
 */
function vietnamNow(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 16);
}

/**
 * Lưu một lá đơn mới nộp cùng các tệp của nó, trong một bước: sinh mã đơn, trạng thái Đã nộp, chưa ai tiếp nhận.
 * Câu trả lời và tệp đã được kiểm tra trước (validateAnswers, validateFile); hàm này không trả lỗi giữa chừng.
 * @param ownerId        id người nộp
 * @param formType       loại đơn lúc nộp (lưu bản chụp, để sửa loại đơn sau này không làm hỏng đơn cũ)
 * @param answers        câu trả lời theo id câu hỏi; tệp mang id tạm của trình duyệt
 * @param filesByTempId  nội dung tệp theo id tạm
 * @returns              dòng tóm tắt của đơn mới, có mã đơn
 */
export function addForm(ownerId: string, formType: FormType, answers: FormAnswers, filesByTempId: ReadonlyMap<string, File>): FormSummary {
  const submittedAt = vietnamNow();
  const code = nextFormCode(formType.prefix, Number(submittedAt.slice(0, 4)), formType.version, FORMS.map((form) => form.code));
  const keptAnswers = storeAnswers(code, formType.sections, answers, filesByTempId, {});

  // Lưu đơn, đơn mới đứng đầu
  FORMS.unshift({
    ownerId,
    code,
    formTypeId: formType.id,
    formTypeName: formType.name,
    submittedAt,
    updatedAt: submittedAt,
    status: 'nop',
    note: '',
    receiverId: null,
    receivedAt: null,
    handlerId: null,
    handlerSince: null,
    answers: keptAnswers,
    formTypeSnapshot: structuredClone(formType),
  });
  return toSummary(FORMS[0]!);
}

/**
 * Câu trả lời đem lưu: chỉ lấy câu trả lời của câu hỏi có trong loại đơn, đè lên câu trả lời cũ
 * (câu trả lời cũ của câu hỏi không còn trong loại đơn vẫn giữ). Tệp đã lưu giữ nguyên;
 * tệp mới được lưu với id mới, tên và dung lượng theo tệp thật.
 * @param code           mã đơn chứa tệp
 * @param sections       các phần của loại đơn lúc nộp
 * @param answers        câu trả lời đã kiểm tra; tệp mới mang id tạm
 * @param filesByTempId  nội dung tệp mới theo id tạm
 * @param oldAnswers     câu trả lời đang lưu ({} khi nộp đơn mới)
 * @returns              câu trả lời mới
 */
function storeAnswers(
  code: string,
  sections: readonly FormSection[],
  answers: FormAnswers,
  filesByTempId: ReadonlyMap<string, File>,
  oldAnswers: FormAnswers,
): FormAnswers {
  const savedFiles = new Map(fileRefsIn(sections, oldAnswers).map((file) => [file.id, file]));
  const storedAnswers: FormAnswers = { ...oldAnswers };
  sections.forEach((section) =>
    section.questions.filter(isAnswerable).forEach((question) => {
      const answer = answers[question.id];
      if (answer === undefined) return;
      storedAnswers[question.id] =
        question.type === 'file' && Array.isArray(answer)
          ? (answer as FileRef[]).map((file) => savedFiles.get(file.id) ?? saveFile(filesByTempId.get(file.id)!, code))
          : answer;
    }),
  );
  return storedAnswers;
}

/**
 * Mọi tệp trong câu trả lời của các câu hỏi tải tệp.
 * @param sections  các phần của loại đơn
 * @param answers   câu trả lời
 * @returns         các FileRef
 */
function fileRefsIn(sections: readonly FormSection[], answers: FormAnswers): FileRef[] {
  return sections
    .flatMap((section) => section.questions)
    .filter((question) => question.type === 'file')
    .flatMap((question) => (Array.isArray(answers[question.id]) ? (answers[question.id] as FileRef[]) : []));
}

/**
 * Id các tệp một lá đơn đang lưu, để biết tệp nào trong câu trả lời gửi lên là tệp giữ lại.
 * @param code  mã đơn
 * @returns     các id; không có đơn thì tập rỗng
 */
export function getSavedFileIds(code: string): Set<string> {
  const form = FORMS.find((candidate) => candidate.code === code);
  return new Set(form ? fileRefsIn(form.formTypeSnapshot.sections, form.answers).map((file) => file.id) : []);
}

/**
 * Lưu nội dung đã sửa của một lá đơn cùng các tệp mới, trong một bước. Đơn Cần bổ sung chuyển sang Đã bổ sung.
 * Tệp bị gỡ khỏi đơn thì xóa hẳn, sau khi đơn đã lưu.
 * Quyền sửa, câu trả lời và tệp đã được kiểm tra trước (canEditForm, validateAnswers, validateSentFiles).
 * @param code           mã đơn
 * @param answers        câu trả lời mới theo id câu hỏi; tệp mới mang id tạm
 * @param filesByTempId  nội dung tệp mới theo id tạm
 * @returns              lá đơn sau khi lưu; không có đơn thì null
 */
export function updateForm(code: string, answers: FormAnswers, filesByTempId: ReadonlyMap<string, File>): FormDetail | null {
  const form = FORMS.find((candidate) => candidate.code === code);
  if (!form) return null;

  // Lưu câu trả lời, tệp mới; đơn Cần bổ sung thành Đã bổ sung
  const oldFileIds = getSavedFileIds(code);
  form.answers = storeAnswers(code, form.formTypeSnapshot.sections, answers, filesByTempId, form.answers);
  form.updatedAt = vietnamNow();
  if (form.status === 'bs') form.status = 'bsg';

  // Đơn đã lưu xong: xóa hẳn các tệp bị gỡ
  const keptFileIds = getSavedFileIds(code);
  oldFileIds.forEach((fileId) => {
    if (!keptFileIds.has(fileId)) FILES.delete(fileId);
  });
  return toDetail(form);
}

/**
 * Tiếp nhận một lá đơn: chuyển sang Đang xét, cán bộ bấm thành người tiếp nhận và người xử lí,
 * xóa lí do của lần Yêu cầu bổ sung trước (bắt đầu lượt xét mới). Quyền và trạng thái đã được kiểm tra trước (canReceiveForm).
 * @param code     mã đơn
 * @param staffId  id cán bộ bấm Tiếp nhận
 * @returns        lá đơn sau khi tiếp nhận; không có đơn thì null
 */
export function receiveForm(code: string, staffId: string): FormDetail | null {
  const form = FORMS.find((candidate) => candidate.code === code);
  if (!form) return null;
  const receivedAt = vietnamNow();
  Object.assign(form, { status: 'xet', note: '', receiverId: staffId, receivedAt, handlerId: staffId, handlerSince: receivedAt });
  return toDetail(form);
}

/**
 * Ra quyết định về một đơn Đang xét: chuyển sang Cần bổ sung, Đã duyệt hoặc Từ chối. Quyền và trạng thái đã được kiểm tra trước (canDecideOn).
 * Không đổi người xử lí và lần lưu gần nhất (updatedAt, là lần người nộp đơn lưu).
 * @param code      mã đơn
 * @param decision  quyết định: 'bs' · 'duyet' · 'tc' (cũng là trạng thái mới của đơn)
 * @param note      lí do (đã bỏ khoảng trắng đầu cuối, "" nếu không ghi); Duyệt thì bỏ qua lí do và xóa lí do cũ
 * @returns         lá đơn sau khi ra quyết định; không có đơn thì null
 */
export function decideForm(code: string, decision: FormDecision, note: string): FormDetail | null {
  const form = FORMS.find((candidate) => candidate.code === code);
  if (!form) return null;
  Object.assign(form, { status: decision, note: decision === 'duyet' ? '' : note });
  if (decision !== 'bs') form.decidedAt = vietnamNow();
  return toDetail(form);
}

/**
 * Cán bộ có thể nhận một lá đơn khi Chuyển giao: mọi cán bộ trừ người đang xử lí đơn.
 * @param code  mã đơn
 * @returns     danh sách cán bộ; không có đơn thì null
 */
export function getTransferTargets(code: string): StaffRef[] | null {
  const form = FORMS.find((candidate) => candidate.code === code);
  if (!form) return null;
  return Object.entries(accounts)
    .filter(([id, account]) => id !== form.handlerId && can(account.role, 'decide'))
    .map(([id]) => personRef(id));
}

/**
 * Chuyển giao một lá đơn: cán bộ nhận thành người xử lí, mốc "Phụ trách từ" tính lại từ lúc này.
 * Người tiếp nhận, trạng thái, lí do không đổi. Quyền và trạng thái đã được kiểm tra trước (canTransferForm).
 * @param code       mã đơn
 * @param toStaffId  id cán bộ nhận
 * @returns          lá đơn sau khi chuyển giao; không có đơn hoặc không có cán bộ đó thì null
 */
export function transferForm(code: string, toStaffId: string): FormDetail | null {
  const form = FORMS.find((candidate) => candidate.code === code);
  const toStaff = accounts[toStaffId];
  if (!form || !toStaff || !can(toStaff.role, 'decide')) return null;
  Object.assign(form, { handlerId: toStaffId, handlerSince: vietnamNow() });
  return toDetail(form);
}

/* ---------- Tệp minh chứng ---------- */

/** Tệp đính kèm trong API giả: thông tin trả cho giao diện, nội dung, mã đơn chứa tệp. */
interface MockFile {
  ref: FileRef;
  content: File;
  formCode: string;
}

/** Các tệp đính kèm của mọi đơn, theo id. Giữ trong bộ nhớ, tải lại trang là mất. */
const FILES = new Map<string, MockFile>();

/**
 * Lưu một tệp của một đơn.
 * @param content   nội dung tệp
 * @param formCode  mã đơn chứa tệp
 * @returns         FileRef có id ở máy chủ
 */
function saveFile(content: File, formCode: string): FileRef {
  const ref: FileRef = { id: `file-${crypto.randomUUID()}`, name: content.name, sizeBytes: content.size };
  FILES.set(ref.id, { ref, content, formCode });
  return ref;
}

/**
 * Các tệp đính kèm của một đơn đã lưu ở máy chủ (dùng trong test).
 * @param formCode  mã đơn
 * @returns         FileRef các tệp; không có thì []
 */
export function getFilesOfForm(formCode: string): FileRef[] {
  return [...FILES.values()].filter((file) => file.formCode === formCode).map((file) => file.ref);
}

/**
 * Nội dung một tệp, nếu người hỏi được xem: là người nộp đơn chứa tệp, hoặc được xem mọi đơn.
 * Tệp mẫu có sẵn (id 'seed-<mã đơn>') không có nội dung thật nên trả một PDF mẫu ghi tên tệp.
 * @param fileId  id tệp ở máy chủ
 * @param viewer  id và vai trò người đang đăng nhập
 * @returns       tệp; không có, hoặc không được xem, thì null
 */
export function getFileContent(fileId: string, viewer: { id: string; role: RoleId }): File | null {
  const stored = FILES.get(fileId);
  const seedCode = fileId.startsWith(SEED_FILE_ID_PREFIX) ? fileId.slice(SEED_FILE_ID_PREFIX.length) : null;
  const form = FORMS.find((candidate) => candidate.code === (stored?.formCode ?? seedCode));
  if (!form || (form.ownerId !== viewer.id && !can(viewer.role, 'viewAll'))) return null;
  if (stored) return stored.content;

  // Tệp mẫu: tìm tên tệp trong câu trả lời của đơn
  const sampleRef = fileRefsIn(form.formTypeSnapshot.sections, form.answers).find((file) => file.id === fileId);
  return sampleRef ? buildSamplePdf(sampleRef.name) : null;
}

/** Đưa tài khoản, lá đơn, tệp về ban đầu (dùng trong test). */
export function resetMockDb(): void {
  accounts = cloneSeed();
  FORMS = seedForms();
  FORM_TYPES = seedFormTypes();
  FILES.clear();
  EXPORT_TEMPLATES = seedExportTemplates();
  try {
    sessionStorage.removeItem(ACCOUNTS_KEY);
  } catch {
    // Không có sessionStorage (vd chạy test): bỏ qua
  }
}

/* ---------- Mẫu xuất file ---------- */

/** Mẫu xuất file trong API giả: thông tin trả cho giao diện và nội dung file .docx. */
interface MockExportTemplate {
  template: ExportTemplate;
  bytes: ArrayBuffer;
}

/**
 * Mẫu ban đầu: loại đơn Xét miễn môn có sẵn một mẫu (như PRINT_TEMPLATES.xmm của artifact/js/sample-template.js).
 * @returns  mẫu theo mã loại đơn
 */
function seedExportTemplates(): Map<string, MockExportTemplate[]> {
  const binary = atob(SAMPLE_EXPORT_TEMPLATE_BASE64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
  const template: ExportTemplate = {
    id: 'tpl-demo',
    name: 'Đơn gửi phòng Đào tạo',
    fileName: 'mau-don-xet-mien-mon.docx',
    sizeBytes: bytes.byteLength,
    uploadedAt: '2026-10-01T09:00',
    uploadedBy: 'Phạm Thu Hà',
  };
  return new Map([['xmm', [{ template, bytes }]]]);
}

/** Mẫu xuất file theo mã loại đơn. Giữ trong bộ nhớ, tải lại trang là về ban đầu. */
let EXPORT_TEMPLATES = seedExportTemplates();

/**
 * Loại đơn có tồn tại không (để quản lí mẫu của nó).
 * @param formTypeId  mã loại đơn
 * @returns           true nếu có
 */
export function formTypeExists(formTypeId: string): boolean {
  return Boolean(findFormType(formTypeId));
}

/**
 * Các mẫu xuất file của một loại đơn, theo thứ tự tải lên.
 * @param formTypeId  mã loại đơn
 * @returns           thông tin các mẫu; không có thì []
 */
export function getExportTemplates(formTypeId: string): ExportTemplate[] {
  return (EXPORT_TEMPLATES.get(formTypeId) ?? []).map(({ template }) => ({ ...template }));
}

/**
 * Một mẫu xuất file kèm nội dung.
 * @param formTypeId  mã loại đơn
 * @param templateId  id mẫu
 * @returns           thông tin và nội dung; không có thì null
 */
export function findExportTemplate(formTypeId: string, templateId: string): { template: ExportTemplate; bytes: ArrayBuffer } | null {
  const stored = (EXPORT_TEMPLATES.get(formTypeId) ?? []).find(({ template }) => template.id === templateId);
  return stored ? { template: { ...stored.template }, bytes: stored.bytes } : null;
}

/**
 * Thêm mẫu xuất file (đã kiểm tra là .docx đọc được).
 * @param formTypeId  mã loại đơn
 * @param upload      tên mẫu, tên file, nội dung file
 * @param staffId     cán bộ tải lên
 * @returns           thông tin mẫu mới
 */
export function addExportTemplate(formTypeId: string, upload: { name: string; fileName: string; bytes: ArrayBuffer }, staffId: string): ExportTemplate {
  const template: ExportTemplate = {
    id: `tpl-${crypto.randomUUID()}`,
    name: upload.name,
    fileName: upload.fileName,
    sizeBytes: upload.bytes.byteLength,
    uploadedAt: vietnamNow(),
    uploadedBy: personRef(staffId).name,
  };
  EXPORT_TEMPLATES.set(formTypeId, [...(EXPORT_TEMPLATES.get(formTypeId) ?? []), { template, bytes: upload.bytes }]);
  return { ...template };
}

/**
 * Đổi tên một mẫu xuất file.
 * @param formTypeId  mã loại đơn
 * @param templateId  id mẫu
 * @param name        tên mới (đã bỏ khoảng trắng đầu cuối)
 * @returns           thông tin mẫu sau khi đổi; không có mẫu thì null
 */
export function renameExportTemplate(formTypeId: string, templateId: string, name: string): ExportTemplate | null {
  const stored = (EXPORT_TEMPLATES.get(formTypeId) ?? []).find(({ template }) => template.id === templateId);
  if (!stored) return null;
  stored.template = { ...stored.template, name };
  return { ...stored.template };
}

/**
 * Xóa một mẫu xuất file.
 * @param formTypeId  mã loại đơn
 * @param templateId  id mẫu
 * @returns           true nếu đã xóa; không có mẫu thì false
 */
export function deleteExportTemplate(formTypeId: string, templateId: string): boolean {
  const list = EXPORT_TEMPLATES.get(formTypeId) ?? [];
  const remaining = list.filter(({ template }) => template.id !== templateId);
  EXPORT_TEMPLATES.set(formTypeId, remaining);
  return remaining.length < list.length;
}

/**
 * Thông tin của một lá đơn để điền mẫu: người nộp đơn (CCCD đầy đủ, MSSV chính), cán bộ, câu trả lời.
 * @param code    mã đơn
 * @param viewer  người xuất file: phải là người nộp, hoặc được xem mọi đơn; bỏ trống = không kiểm tra (ví dụ cho Bảng mã của cán bộ)
 * @returns       source: thông tin để điền · formTypeId: loại đơn của đơn; không có đơn, hoặc không được xem, thì null
 */
export function getExportSource(code: string, viewer?: { id: string; role: RoleId }): { source: ExportSource; formTypeId: string } | null {
  const form = FORMS.find((candidate) => candidate.code === code);
  if (!form || (viewer && form.ownerId !== viewer.id && !can(viewer.role, 'viewAll'))) return null;
  return { source: toExportSource(form), formTypeId: form.formTypeId };
}

/**
 * Dựng thông tin điền mẫu của một lá đơn.
 * @param form  lá đơn trong API giả
 * @returns     thông tin để điền
 */
function toExportSource(form: MockForm): ExportSource {
  const owner = getProfile(form.ownerId);
  const students = getStudents(form.ownerId);
  const mainStudent = students.find((student) => student.studentId === owner.mainStudentId) ?? students[0] ?? null;
  const decided = form.status === 'duyet' || form.status === 'tc';
  return {
    code: form.code,
    formTypeName: form.formTypeName,
    submittedAt: form.submittedAt,
    status: form.status,
    receiverName: staffOf(form.receiverId)?.name ?? null,
    handlerName: staffOf(form.handlerId)?.name ?? null,
    decidedAt: decided ? (form.decidedAt ?? form.updatedAt) : null,
    note: form.note,
    applicant: { name: owner.name, email: personRef(form.ownerId).email, phone: owner.phone, cccd: owner.cccd },
    mainStudent,
    sections: structuredClone(form.formTypeSnapshot.sections),
    answers: structuredClone(form.answers),
  };
}

/**
 * Ngày hôm nay theo giờ Việt Nam (mã {ngay_xuat}).
 * @returns  vd '2026-11-11'
 */
export function vietnamToday(): string {
  return vietnamNow().slice(0, 10);
}

/* ---------- Phiên đăng nhập ---------- */

/**
 * Dựng phiên đăng nhập của một tài khoản: người dùng (họ tên mới nhất) + vai trò hiện tại + đã bổ sung thông tin chưa.
 * @param userId  id tài khoản đang đăng nhập
 * @returns       phiên đăng nhập
 */
export function toSession(userId: string): Session {
  const account = getProfile(userId);
  return {
    user: { id: userId, email: account.email, name: account.name } satisfies SessionUser,
    role: account.role,
    profileCompleted: account.completed,
  };
}

/* JUST FOR DEMO: START · đăng nhập thử theo vai trò */
/**
 * Chọn tài khoản để đăng nhập thử một vai trò: tài khoản mẫu của vai trò đó; nếu Admin đã đổi vai trò của tài khoản mẫu
 * thì lấy tài khoản đầu tiên đang có vai trò này.
 * @param role  vai trò muốn đăng nhập
 * @returns     id tài khoản; không còn tài khoản nào có vai trò này thì null
 */
export function demoAccountFor(role: RoleId): string | null {
  if (accounts[DEMO_USER_IDS[role]]?.role === role) return DEMO_USER_IDS[role];
  return Object.entries(accounts).find(([, account]) => account.role === role)?.[0] ?? null;
}
/* JUST FOR DEMO: END */

/* Id tài khoản đang đăng nhập, lưu trong sessionStorage để tải lại trang không bị đăng xuất
   (giống cookie phiên của backend thật). Đóng tab là mất. */
const SESSION_KEY = 'mock-session-user';

/**
 * Đọc phiên đăng nhập giả hiện tại. Vai trò lấy theo tài khoản, nên Admin đổi vai trò thì phiên đổi theo.
 * @returns  phiên (người dùng + vai trò); chưa đăng nhập thì null
 */
export function readSession(): Session | null {
  // Đọc id đã lưu (trình duyệt chặn bộ nhớ thì coi như chưa đăng nhập)
  let userId: string | null = null;
  try {
    userId = sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }

  // Không còn tài khoản này thì coi như chưa đăng nhập
  if (!userId || !accounts[userId]) return null;
  return toSession(userId);
}

/**
 * Ghi hoặc xóa phiên đăng nhập giả.
 * @param userId  id tài khoản đăng nhập; null = đăng xuất
 */
export function writeSession(userId: string | null): void {
  try {
    if (userId) sessionStorage.setItem(SESSION_KEY, userId);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Trình duyệt chặn bộ nhớ: phiên chỉ không giữ được khi tải lại trang
  }
}
