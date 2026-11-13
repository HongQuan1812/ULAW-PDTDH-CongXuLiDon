/* Lá đơn mẫu (Xét miễn môn) và người tiếp nhận, xử lí. */
import type { FormSummary, FormType } from '../api-contract';
import type { FileRef, FormAnswers, FormStatus, TableCell } from '../aux-schema';
import { formatFormCode } from '../business-rules';
import { FORM_TYPE_SEED } from './form-types';
import { cloneSeedValue } from './clone';
import { addHours, dateText, twoDigits } from './time';

/** Lá đơn trong API giả: dòng tóm tắt, kèm id người nộp, cán bộ, các mốc thời gian, nội dung và bản chụp loại đơn lúc nộp. */
export interface SeedForm extends FormSummary {
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
type UnassignedForm = Omit<SeedForm, 'receiverId' | 'handlerId' | 'handlerSince'>;

/* 3 cán bộ tiếp nhận / xử lí các đơn mẫu. */
export const SEED_STAFF_IDS = ['cb-1', 'cb-2', 'cb-3'] as const;

/* 10 sinh viên khác có đơn mẫu (tài khoản sv-2 … sv-11). */
const OTHER_STUDENT_IDS = Array.from({ length: 10 }, (_, i) => `sv-${i + 2}`);

/* Các môn mẫu cho bảng "Các môn xin miễn": [môn của trường, số tín chỉ, môn tương đương, cơ sở đào tạo]. */
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

/* Lí do mẫu Phòng Đào tạo ghi khi Yêu cầu bổ sung / Từ chối; trạng thái khác không có lí do. */
/** Tiền tố id của tệp mẫu có sẵn trong đơn mẫu; sau tiền tố là mã đơn chứa tệp. */
export const SEED_FILE_ID_PREFIX = 'seed-';

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
const xmmSnapshot = () => cloneSeedValue(FORM_TYPE_SEED.find((formType) => formType.id === 'xmm')!);
/**
 * Sinh 18 đơn Xét miễn môn mẫu cho sinh viên đăng nhập thử
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
 * Sinh đơn của 10 sinh viên khác (sv-2 … sv-11):
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

/** Bản chụp phiên bản mới nhất (2) của đơn thử nghiệm cho đơn mẫu. */
const TEST_FORM_VERSION = 2;
const testSnapshot = () => cloneSeedValue(FORM_TYPE_SEED.find((formType) => formType.id === 'thu')!);

/** Văn bản có định dạng gồm các đoạn, cho câu trả lời "đoạn văn". */
const richText = (...paragraphs: string[]): FormAnswers[string] => ({
  type: 'doc',
  content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
});

/* Câu trả lời mẫu của đơn thử nghiệm: đủ loại câu hỏi, số dòng bảng 0 – 4, số lựa chọn và số tệp khác nhau. */
const TEST_FORM_SAMPLES: { status: FormStatus; answers: FormAnswers }[] = [
  {
    status: 'nop',
    answers: {
      'tieu-de': 'Xin nghỉ học kỳ 1 vì lí do sức khỏe',
      'li-do': richText('Em bị tai nạn giao thông, cần điều trị dài ngày.', 'Em xin phép nghỉ từ đầu học kỳ.'),
      'so-tin-chi': 62,
      'ngay-nghi': '2026-09-05',
      'hoc-ky': 'Học kỳ 1',
      'giay-to': ['Bảng điểm', 'Giấy xác nhận sinh viên'],
      'co-so': 'Cơ sở Nguyễn Tất Thành',
      'mon-hoc': [['Luật Dân sự 1', 3, 'Lớp DS01'], ['Luật Hình sự 1', 3, 'Lớp HS02'], ['Tiếng Anh pháp lý 1', 2, 'Lớp TA03'], ['Logic học', 2, 'Học cùng khóa trên']],
      'tep-dinh-kem': [{ id: '', name: 'Giay_ra_vien.pdf', sizeBytes: 412_880 }],
    },
  },
  {
    status: 'xet',
    answers: {
      'tieu-de': 'Đăng ký học vượt hai môn',
      'li-do': richText('Em muốn rút ngắn thời gian học.'),
      'so-tin-chi': 90,
      'ngay-nghi': '',
      'hoc-ky': 'Học kỳ hè',
      'giay-to': ['Bảng điểm', 'Giấy xác nhận sinh viên', 'Đơn có chữ ký phụ huynh'],
      'co-so': 'Cơ sở Bình Thạnh',
      'mon-hoc': [['Luật Thương mại 1', 3, 'Lớp TM01'], ['Luật Lao động', 2, 'Lớp LD01']],
      'tep-dinh-kem': [],
    },
  },
  {
    status: 'bs',
    answers: {
      'tieu-de': 'Xin hoãn thi cuối kỳ',
      'li-do': richText('Em trùng lịch thi hai môn.'),
      'so-tin-chi': 48,
      'ngay-nghi': '2026-10-12',
      'hoc-ky': 'Học kỳ 2',
      'giay-to': ['Bảng điểm'],
      'co-so': '',
      'mon-hoc': [],
      'tep-dinh-kem': [{ id: '', name: 'Lich_thi_trung.docx', sizeBytes: 98_304 }, { id: '', name: 'Don_xac_nhan.pdf', sizeBytes: 215_040 }],
    },
  },
  {
    status: 'duyet',
    answers: {
      'tieu-de': 'Đăng ký học lại ba môn',
      'li-do': richText('Em chưa đạt ba môn ở học kỳ trước.', 'Em xin đăng ký học lại cùng khóa dưới.', 'Em xin cảm ơn Phòng Đào tạo.'),
      'so-tin-chi': 75,
      'ngay-nghi': '2026-08-20',
      'hoc-ky': 'Học kỳ 1',
      'giay-to': ['Bảng điểm', 'Đơn có chữ ký phụ huynh'],
      'co-so': 'Cơ sở Thủ Đức',
      'mon-hoc': [['Luật Hành chính', 3, 'Học lại'], ['Luật Hiến pháp', 3, 'Học lại'], ['Luật Đất đai', 2, 'Học lại'], ['Luật Tố tụng dân sự', 3, 'Lớp TT02'], ['Công pháp quốc tế', 3, 'Học cải thiện']],
      'tep-dinh-kem': [{ id: '', name: 'Bang_diem_hoc_ky.pdf', sizeBytes: 530_112 }],
    },
  },
  {
    status: 'tc',
    answers: {
      'tieu-de': 'Xin bảo lưu kết quả',
      'li-do': richText('Em xin bảo lưu để đi du học trao đổi.'),
      'so-tin-chi': 30,
      'ngay-nghi': '2026-11-01',
      'hoc-ky': 'Học kỳ 2',
      'giay-to': ['Giấy xác nhận sinh viên'],
      'co-so': 'Cơ sở Nguyễn Tất Thành',
      'mon-hoc': [['Triết học Mác – Lênin', 3, 'Học bù']],
      'tep-dinh-kem': [],
    },
  },
];

/**
 * Sinh các đơn thử nghiệm mẫu (đủ 10 loại câu hỏi), của các sinh viên khác sv-1.
 * @returns  các đơn thử nghiệm đã điền, mã THU-<năm>-002-<STT>
 */
function seedTestForms(): UnassignedForm[] {
  return TEST_FORM_SAMPLES.map(({ status, answers }, i) => {
    const day = new Date(2026, 9, 28 - i * 6);
    const code = formatFormCode('THU', day.getFullYear(), TEST_FORM_VERSION, i + 1);
    const submittedAt = `${dateText(day)}T${twoDigits(9 + i)}:${twoDigits((i * 23) % 60)}`;
    const files = (answers['tep-dinh-kem'] as FileRef[]).map((file, k) => ({ ...file, id: `${SEED_FILE_ID_PREFIX}${code}-${k + 1}` }));
    return {
      ownerId: OTHER_STUDENT_IDS[i]!,
      code,
      formTypeId: 'thu',
      formTypeName: 'Đơn thử nghiệm (đủ loại câu hỏi)',
      submittedAt,
      updatedAt: submittedAt,
      status,
      note: SAMPLE_NOTES[status] ?? '',
      receivedAt: status === 'nop' ? null : addHours(submittedAt, 4 + i),
      answers: cloneSeedValue({ ...answers, 'tep-dinh-kem': files }),
      formTypeSnapshot: testSnapshot(),
    };
  });
}

/**
 * Gán người tiếp nhận, người xử lí cho các đơn:
 * đơn Đã nộp chưa ai tiếp nhận; đơn khác do lần lượt 3 cán bộ tiếp nhận,
 * cứ 5 đơn có 1 đơn đã chuyển giao cho người kế tiếp (26 giờ sau khi tiếp nhận).
 * @param forms  các đơn chưa gán
 * @returns      các đơn đã gán cán bộ
 */
function assignStaff(forms: UnassignedForm[]): SeedForm[] {
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


/**
 * Dựng toàn bộ đơn mẫu.
 * @returns  đơn của sinh viên đăng nhập thử rồi đơn của sinh viên khác, đã gán cán bộ
 */
export function seedForms(): SeedForm[] {
  return assignStaff([...seedStudentForms(), ...seedOtherStudentForms(), ...seedTestForms()]);
}
