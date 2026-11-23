/* Lá đơn mẫu (mọi loại đơn, nhiều nhất là loại đơn chính MAIN_SEED_FORM_TYPE_ID) và người tiếp nhận, xử lí. */
import type { FormSummary, FormType } from '../api-contract';
import type { FormAnswers, FormStatus } from '../aux-schema';
import { formatFormCode } from '../business-rules';
import { MAIN_SEED_FORM_TYPE_ID, seedFormTypes } from './form-types';
import { SAMPLE_SUBJECTS, sampleAnswersFor } from './sample-answers';
import { cloneSeedValue } from './clone';
import { addHours, dateText, twoDigits } from './time';

/** Lá đơn trong API giả: dòng tóm tắt, kèm id người nộp, cán bộ, các mốc thời gian, nội dung và bản chụp loại đơn lúc nộp. */
export interface SeedForm extends FormSummary {
  ownerId: string;
  /** Lúc ra quyết định gần nhất (Yêu cầu bổ sung / Duyệt / Từ chối; mã {ngay_xu_li} khi xuất file); null = chưa ra quyết định */
  decidedAt: string | null;
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
type UnassignedForm = Omit<SeedForm, 'receiverId' | 'handlerId' | 'handlerSince' | 'decidedAt'>;

/* 3 cán bộ tiếp nhận / xử lí các đơn mẫu. */
export const SEED_STAFF_IDS = ['cb-1', 'cb-2', 'cb-3'] as const;

/* 10 sinh viên khác có đơn mẫu (tài khoản sv-2 … sv-11). */
const OTHER_STUDENT_IDS = Array.from({ length: 10 }, (_, i) => `sv-${i + 2}`);

/* Lí do mẫu Phòng Đào tạo ghi khi Yêu cầu bổ sung / Từ chối; trạng thái khác không có lí do. */
/** Tiền tố id của tệp mẫu có sẵn trong đơn mẫu; sau tiền tố là mã đơn chứa tệp. */
export const SEED_FILE_ID_PREFIX = 'seed-';

const SUPPLEMENT_NOTE = 'Giấy tờ minh chứng chưa có dấu xác nhận. Vui lòng nộp lại bản có xác nhận.';
const SAMPLE_NOTES: Partial<Record<FormStatus, string>> = {
  bs: SUPPLEMENT_NOTE,
  bsg: SUPPLEMENT_NOTE,
  tc: 'Hồ sơ không đủ điều kiện theo quy chế đào tạo.',
};

/** Học phần mẫu của một dòng bảng. */
type SampleSubject = (typeof SAMPLE_SUBJECTS)[number];

/**
 * Câu trả lời mẫu của một đơn thuộc loại đơn chính (XMR): bảng học phần, cơ sở đào tạo, một tệp bảng điểm (tệp mẫu không có nội dung thật).
 * @param code      mã đơn, để đặt id tệp
 * @param subjects  các học phần xin miễn
 * @param fileName  tên tệp bảng điểm
 * @returns         câu trả lời theo id câu hỏi của loại đơn xmr
 */
function sampleAnswers(code: string, subjects: SampleSubject[], fileName: string): FormAnswers {
  const sizeBytes = 150_000 + (Number(code.slice(-5)) * 7_919) % 900_000;
  return {
    'hoc-phan': subjects.map(([name, credits, equivalent], row) => [name, credits, equivalent, `${credits} TC`, 7 + (row % 3) * 0.5]),
    'co-so-dao-tao': subjects[0]![3],
    'hinh-thuc-dao-tao': 'Chính quy',
    'minh-chung': [{ id: `${SEED_FILE_ID_PREFIX}${code}`, name: fileName, sizeBytes }],
  };
}

/** Các loại đơn ở dev (phiên bản đang mở là bản mới nhất). */
const SEED_FORM_TYPES = seedFormTypes();

/**
 * Bản chụp phiên bản mới nhất của một loại đơn mẫu, kèm số phiên bản (để ghi vào mã đơn).
 * @param formTypeId  mã loại đơn
 * @returns           bản chụp loại đơn, số phiên bản
 */
function latestSnapshot(formTypeId: string): { snapshot: FormType; version: number } {
  const formType = SEED_FORM_TYPES.find((candidate) => candidate.id === formTypeId)!;
  const latest = formType.versions.at(-1)!;
  const { name, description, status, sections, version } = cloneSeedValue(latest);
  return { snapshot: { id: formType.id, prefix: formType.prefix, name, description, version, status, sections }, version };
}

/** Bản chụp loại đơn chính cho đơn mẫu. */
const mainSnapshot = () => latestSnapshot(MAIN_SEED_FORM_TYPE_ID).snapshot;
const MAIN_PREFIX = SEED_FORM_TYPES.find((formType) => formType.id === MAIN_SEED_FORM_TYPE_ID)!.prefix;

/**
 * Sinh 18 đơn của loại đơn chính cho sinh viên đăng nhập thử
 * (trạng thái, mã đơn, ngày nộp, học phần, tệp, lí do cố định), để bảng có nhiều trang, đủ các trạng thái.
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
    const code = formatFormCode(MAIN_PREFIX, day.getFullYear(), 1, 1520 - i * 83);
    const submittedAt = `${date}T${twoDigits(7 + (i % 4))}:${twoDigits((i * 17) % 60)}`;
    const updatedAt = i % 4 === 1 ? `${date}T${twoDigits(13 + (i % 5))}:${twoDigits((i * 29) % 60)}` : submittedAt;

    // 1–3 học phần, một tệp bảng điểm
    const subjects = Array.from({ length: 1 + ((i * 7) % 3) }, (_, k) => SAMPLE_SUBJECTS[(i * 3 + k * 5) % SAMPLE_SUBJECTS.length]!);
    const fileName = `Bang_diem_${i % 2 ? 'hoc_ky' : 'toan_khoa'}_${i + 1}.pdf`;

    day = new Date(day.getTime() - (9 + ((i * 13) % 17)) * 86_400_000);
    return {
      ownerId: 'sv-1',
      code,
      formTypeId: MAIN_SEED_FORM_TYPE_ID,
      formTypeName: mainSnapshot().name,
      submittedAt,
      updatedAt,
      status,
      note: SAMPLE_NOTES[status] ?? '',
      receivedAt: status === 'nop' ? null : addHours(submittedAt, 3 + (i % 3) * 18),
      answers: sampleAnswers(code, subjects, fileName),
      formTypeSnapshot: mainSnapshot(),
    };
  });
}

/**
 * Sinh đơn của 10 sinh viên khác (sv-2 … sv-11):
 * sinh viên thứ i có 1 + i % 3 đơn, tổng 19 đơn, mỗi đơn một học phần. Dùng cho mục "Đơn phụ trách" của cán bộ.
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
      const code = formatFormCode(MAIN_PREFIX, day.getFullYear(), 1, 1500 - formIndex * 37);
      const submittedAt = `${dateText(day)}T${twoDigits(8 + (formIndex % 9))}:${twoDigits((formIndex * 13) % 60)}`;
      const status = statuses[formIndex % statuses.length]!;
      const updatedAt = status === 'bsg' ? addHours(submittedAt, 30) : formIndex % 5 === 2 ? addHours(submittedAt, 5) : submittedAt;

      forms.push({
        ownerId: OTHER_STUDENT_IDS[student]!,
        code,
        formTypeId: MAIN_SEED_FORM_TYPE_ID,
        formTypeName: mainSnapshot().name,
        submittedAt,
        updatedAt,
        status,
        note: SAMPLE_NOTES[status] ?? '',
        receivedAt: status === 'nop' ? null : addHours(submittedAt, 3 + (formIndex % 3) * 18),
        answers: sampleAnswers(code, [subjects[formIndex % subjects.length]!], `Bang_diem_${formIndex + 1}.pdf`),
        formTypeSnapshot: mainSnapshot(),
      });
    }
  }
  return forms;
}

/** Số đơn mẫu của mỗi loại đơn khác loại đơn chính. */
const FORMS_PER_OTHER_TYPE = 3;

/**
 * Sinh đơn mẫu cho mọi loại đơn khác loại đơn chính: mỗi loại FORMS_PER_OTHER_TYPE đơn của các sinh viên khác sv-1,
 * đủ các trạng thái, câu trả lời dựng theo cấu trúc loại đơn (sampleAnswersFor).
 * @returns  các đơn, mã <TIỀN TỐ>-2026-<phiên bản mới nhất>-<STT từ 1>
 */
function seedEveryTypeForms(): UnassignedForm[] {
  const statuses: FormStatus[] = ['nop', 'xet', 'duyet', 'bs', 'tc', 'bsg'];
  const forms: UnassignedForm[] = [];
  let formIndex = 0;

  for (const formType of SEED_FORM_TYPES.filter((candidate) => candidate.id !== MAIN_SEED_FORM_TYPE_ID)) {
    const { snapshot, version } = latestSnapshot(formType.id);
    for (let k = 0; k < FORMS_PER_OTHER_TYPE; k++, formIndex++) {
      // Ngày nộp rải trong khoảng 150 ngày trước 31/10/2026, giờ nộp trong giờ hành chính
      const day = new Date(2026, 9, 31 - ((formIndex * 7) % 150));
      const code = formatFormCode(formType.prefix, day.getFullYear(), version, k + 1);
      const submittedAt = `${dateText(day)}T${twoDigits(8 + (formIndex % 9))}:${twoDigits((formIndex * 19) % 60)}`;
      const status = statuses[formIndex % statuses.length]!;

      forms.push({
        ownerId: OTHER_STUDENT_IDS[formIndex % OTHER_STUDENT_IDS.length]!,
        code,
        formTypeId: formType.id,
        formTypeName: snapshot.name,
        submittedAt,
        updatedAt: status === 'bsg' ? addHours(submittedAt, 30) : submittedAt,
        status,
        note: SAMPLE_NOTES[status] ?? '',
        receivedAt: status === 'nop' ? null : addHours(submittedAt, 4 + (formIndex % 5)),
        answers: sampleAnswersFor(snapshot.sections, formIndex, code, dateText(day), SEED_FILE_ID_PREFIX),
        formTypeSnapshot: cloneSeedValue(snapshot),
      });
    }
  }
  return forms;
}

/**
 * Gán người tiếp nhận, người xử lí cho các đơn:
 * đơn Đã nộp chưa ai tiếp nhận; đơn khác do lần lượt 3 cán bộ tiếp nhận,
 * cứ 5 đơn có 1 đơn đã chuyển giao cho người kế tiếp (26 giờ sau khi tiếp nhận).
 * Đơn Cần bổ sung / Đã duyệt / Từ chối có lúc ra quyết định: 20 giờ sau khi người xử lí nhận đơn.
 * @param forms  các đơn chưa gán
 * @returns      các đơn đã gán cán bộ, kèm lúc ra quyết định
 */
function assignStaff(forms: UnassignedForm[]): SeedForm[] {
  return forms.map((form, i) => {
    if (!form.receivedAt) return { ...form, receiverId: null, handlerId: null, handlerSince: null, decidedAt: null };

    // Người tiếp nhận, người xử lí
    const receiverId = SEED_STAFF_IDS[i % SEED_STAFF_IDS.length]!;
    const transferred = i % 5 === 2;
    const handlerSince = transferred ? addHours(form.receivedAt, 26) : form.receivedAt;

    // Lúc ra quyết định
    const decided = form.status === 'bs' || form.status === 'duyet' || form.status === 'tc';
    return {
      ...form,
      receiverId,
      handlerId: transferred ? SEED_STAFF_IDS[(i + 1) % SEED_STAFF_IDS.length]! : receiverId,
      handlerSince,
      decidedAt: decided ? addHours(handlerSince, 20) : null,
    };
  });
}


/**
 * Dựng toàn bộ đơn mẫu.
 * @returns  đơn của sinh viên đăng nhập thử rồi đơn của sinh viên khác, đã gán cán bộ
 */
export function seedForms(): SeedForm[] {
  return assignStaff([...seedStudentForms(), ...seedOtherStudentForms(), ...seedEveryTypeForms()]);
}
