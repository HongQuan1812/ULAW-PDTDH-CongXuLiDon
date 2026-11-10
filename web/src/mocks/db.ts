/* Dữ liệu giả của API giả, giữ trong bộ nhớ trình duyệt. */
import type {
  FileRef,
  FormAnswers,
  FormStatus,
  FormSummary,
  FormType,
  HandledFormSummary,
  OpenFormType,
  RoleId,
  Session,
  SessionUser,
  StaffRef,
  StudentInfo,
  UpdateProfileRequest,
} from '@ulaw/shared';
import { FormTypeSchema, isAnswerable, nextFormCode } from '@ulaw/shared';

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

/* ---------- Loại đơn ---------- */

/* Loại đơn ban đầu.
   - Xét miễn môn: như TYPES.xmm trong artifact/js/config.js.
   - Đơn thử nghiệm: đủ 10 loại câu hỏi, để xem giao diện từng loại khi chưa có trình soạn loại đơn (bước 7).
   Cấu trúc khai báo dạng thô rồi cho qua FormTypeSchema, để điền sẵn giá trị mặc định (required, main…) như máy chủ. */
const FORM_TYPES: FormType[] = [
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
            label: 'Lưu ý',
            help: 'Đây là khối thông báo: không cần trả lời.\nNội dung có thể xuống dòng.',
          },
          { id: 'tieu-de', type: 'text', label: 'Tiêu đề đơn', required: true, help: 'Trả lời ngắn, một dòng.' },
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
          { id: 'tep-dinh-kem', type: 'file', label: 'Tệp đính kèm', accept: ['pdf', 'docx', 'xlsx'], maxMB: 5 },
        ],
      },
    ],
  },
].map((rawFormType) => FormTypeSchema.parse(rawFormType));

/**
 * Các loại đơn đang nhận đơn (trạng thái Đang mở).
 * @returns  loại đơn, chưa có cấu trúc các phần; không có thì []
 */
export function getOpenFormTypes(): OpenFormType[] {
  return FORM_TYPES.filter((formType) => formType.status === 'open').map(({ id, name, prefix, description }) => ({
    id,
    name,
    prefix,
    description,
  }));
}

/**
 * Một loại đơn, đủ cấu trúc các phần, câu hỏi.
 * @param formTypeId         mã loại đơn, vd 'xmm'
 * @param canSeeUnpublished  true: lấy được cả loại đơn Nháp / Đã đóng (người quản lí loại đơn)
 * @returns                  loại đơn; không có, hoặc không được xem, thì null
 */
export function getFormType(formTypeId: string, canSeeUnpublished: boolean): FormType | null {
  const formType = FORM_TYPES.find((candidate) => candidate.id === formTypeId);
  if (!formType || (formType.status !== 'open' && !canSeeUnpublished)) return null;
  return formType;
}

/* ---------- Lá đơn ---------- */

/** Thêm số 0 phía trước cho đủ 2 chữ số, vd 7 → "07". */
const twoDigits = (number: number) => String(number).padStart(2, '0');

/** Ngày dạng 'YYYY-MM-DD' theo giờ máy. */
const dateText = (day: Date) => `${day.getFullYear()}-${twoDigits(day.getMonth() + 1)}-${twoDigits(day.getDate())}`;

/** Lá đơn trong API giả: dòng tóm tắt, kèm id người nộp, người tiếp nhận, người xử lí (null = chưa tiếp nhận).
    Đơn nộp qua POST /forms có thêm câu trả lời và bản chụp cấu trúc loại đơn lúc nộp; đơn mẫu chưa có. */
interface MockForm extends FormSummary {
  ownerId: string;
  receiverId: string | null;
  handlerId: string | null;
  answers?: FormAnswers;
  formTypeSnapshot?: FormType;
}

/** Lá đơn chưa gán cán bộ. */
type UnassignedForm = Omit<MockForm, 'receiverId' | 'handlerId'>;

/* Cán bộ Phòng Đào tạo mẫu, như SAMPLE_STAFF trong artifact/js/sample-data.js.
   cb-1 (Người xử lí đơn) và cb-3 (Admin) là tài khoản đăng nhập thử. */
const STAFF: StaffRef[] = [
  { id: 'cb-1', name: 'Phạm Thu Hà', email: 'thuha.pham.pdt@hcmulaw.edu.vn' },
  { id: 'cb-2', name: 'Trần Quốc Việt', email: 'quocviet.tran.pdt@hcmulaw.edu.vn' },
  { id: 'cb-3', name: 'Lê Ngọc Diệp', email: 'ngocdiep.le.pdt@hcmulaw.edu.vn' },
];

/**
 * Sinh 18 đơn Xét miễn môn mẫu cho sinh viên đăng nhập thử, như hàm seed() trong artifact/js/sample-data.js
 * (cùng trạng thái, mã đơn, ngày nộp), để bảng có nhiều trang, đủ các trạng thái.
 * @returns  các đơn của sv-1, đơn mới nộp đứng đầu
 */
function seedStudentForms(): UnassignedForm[] {
  const statuses: FormStatus[] = [
    'nop', 'xet', 'xet', 'bs', 'duyet', 'xet', 'duyet', 'tc', 'duyet',
    'bsg', 'duyet', 'duyet', 'tc', 'duyet', 'duyet', 'tc', 'duyet', 'duyet',
  ];
  let day = new Date(2026, 9, 30);

  return statuses.map((status, i) => {
    // Ngày nộp lùi dần, giờ nộp trong buổi sáng
    const date = dateText(day);
    const form: UnassignedForm = {
      ownerId: 'sv-1',
      code: `XMM-${day.getFullYear()}-${String(1520 - i * 83).padStart(5, '0')}`,
      formTypeId: 'xmm',
      formTypeName: 'Xét miễn môn',
      submittedAt: `${date}T${twoDigits(7 + (i % 4))}:${twoDigits((i * 17) % 60)}`,
      status,
    };
    day = new Date(day.getTime() - (9 + ((i * 13) % 17)) * 86_400_000);
    return form;
  });
}

/**
 * Sinh đơn của 10 sinh viên khác (sv-2 … sv-11), như hàm seedOthers() trong artifact/js/sample-data.js:
 * sinh viên thứ i có 1 + i % 3 đơn, tổng 19 đơn. Dùng cho mục "Đơn phụ trách" của cán bộ.
 * @returns  các đơn
 */
function seedOtherStudentForms(): UnassignedForm[] {
  const statuses: FormStatus[] = ['nop', 'xet', 'bs', 'duyet', 'tc', 'bsg', 'xet', 'duyet'];
  const forms: UnassignedForm[] = [];
  let formIndex = 0;

  for (let student = 0; student < 10; student++) {
    for (let j = 0; j < 1 + (student % 3); j++, formIndex++) {
      const day = new Date(2026, 9, 31 - ((formIndex * 11) % 200));
      forms.push({
        ownerId: `sv-${student + 2}`,
        code: `XMM-${day.getFullYear()}-${String(1500 - formIndex * 37).padStart(5, '0')}`,
        formTypeId: 'xmm',
        formTypeName: 'Xét miễn môn',
        submittedAt: `${dateText(day)}T${twoDigits(8 + (formIndex % 9))}:${twoDigits((formIndex * 13) % 60)}`,
        status: statuses[formIndex % statuses.length]!,
      });
    }
  }
  return forms;
}

/**
 * Gán người tiếp nhận, người xử lí cho các đơn, như đoạn cuối artifact/js/sample-data.js:
 * đơn Đã nộp chưa ai tiếp nhận; đơn khác do lần lượt 3 cán bộ tiếp nhận, cứ 5 đơn có 1 đơn đã chuyển giao cho người kế tiếp.
 * @param forms  các đơn chưa gán
 * @returns      các đơn đã gán cán bộ
 */
function assignStaff(forms: UnassignedForm[]): MockForm[] {
  return forms.map((form, i) => {
    if (form.status === 'nop') return { ...form, receiverId: null, handlerId: null };
    const receiver = STAFF[i % STAFF.length]!;
    const handler = i % 5 === 2 ? STAFF[(i + 1) % STAFF.length]! : receiver;
    return { ...form, receiverId: receiver.id, handlerId: handler.id };
  });
}

/* Mọi lá đơn, đơn mới nộp đứng đầu. Sửa, xử lí đơn làm ở các bước sau. */
const FORMS: MockForm[] = assignStaff([...seedStudentForms(), ...seedOtherStudentForms()]);

/**
 * Chỉ giữ phần trả về cho bảng đơn (bỏ id nội bộ, câu trả lời, bản chụp loại đơn).
 * @param form  lá đơn trong API giả
 * @returns     dòng tóm tắt theo FormSummarySchema
 */
function toSummary({ code, formTypeId, formTypeName, submittedAt, status }: MockForm): FormSummary {
  return { code, formTypeId, formTypeName, submittedAt, status };
}

/**
 * Tìm cán bộ theo id.
 * @param staffId  id tài khoản cán bộ; null = chưa có
 * @returns        cán bộ; không có thì null
 */
function staffOf(staffId: string | null): StaffRef | null {
  return STAFF.find((staff) => staff.id === staffId) ?? null;
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
  const code = nextFormCode(formType.prefix, Number(submittedAt.slice(0, 4)), FORMS.map((form) => form.code));

  // Chỉ giữ câu trả lời của câu hỏi có trong loại đơn; tệp được lưu với id mới, tên và dung lượng theo tệp thật
  const keptAnswers: FormAnswers = {};
  formType.sections.forEach((section) =>
    section.questions.filter(isAnswerable).forEach((question) => {
      const answer = answers[question.id];
      if (answer === undefined) return;
      keptAnswers[question.id] =
        question.type === 'file' && Array.isArray(answer)
          ? (answer as FileRef[]).map((file) => saveFile(filesByTempId.get(file.id)!, code))
          : answer;
    }),
  );

  // Lưu đơn, đơn mới đứng đầu
  FORMS.unshift({
    ownerId,
    code,
    formTypeId: formType.id,
    formTypeName: formType.name,
    submittedAt,
    status: 'nop',
    receiverId: null,
    handlerId: null,
    answers: keptAnswers,
    formTypeSnapshot: structuredClone(formType),
  });
  return toSummary(FORMS[0]!);
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
 * Các tệp đính kèm của một đơn (dùng trong test; trang chi tiết đơn dùng ở bước sau).
 * @param formCode  mã đơn
 * @returns         FileRef các tệp; không có thì []
 */
export function getFilesOfForm(formCode: string): FileRef[] {
  return [...FILES.values()].filter((file) => file.formCode === formCode).map((file) => file.ref);
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
