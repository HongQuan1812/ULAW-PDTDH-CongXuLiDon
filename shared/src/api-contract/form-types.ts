/* HỢP ĐỒNG nhóm API loại đơn: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này.
   Quy ước tên: form = lá đơn sinh viên nộp · form type = loại đơn (mẫu do cán bộ soạn).

   Mỗi loại đơn có nhiều phiên bản (1, 2, 3…). Mã đơn (tiền tố) dùng chung; tên, mô tả, các phần, câu hỏi thuộc từng phiên bản.
   - Nháp: phiên bản đang soạn, sửa được, xóa được. Mỗi loại đơn có nhiều nhất một phiên bản Nháp, luôn là phiên bản mới nhất.
   - Mở một phiên bản (Đang mở) thì nội dung phiên bản đó khóa cứng; phiên bản đang mở trước đó tự chuyển sang Đã đóng
     (mỗi lúc chỉ một phiên bản nhận đơn). Phiên bản đã khóa chỉ đổi qua lại Đang mở / Đã đóng.
   - Muốn sửa nội dung đã khóa thì tạo phiên bản mới. Mã đơn khóa từ khi phiên bản đầu tiên được mở. */
import { z } from 'zod';
import { QUESTION_TYPES, TABLE_COLUMN_TYPES, type QuestionType } from '../aux-schema/form-types--question-types';
import { FormSectionSchema } from '../aux-schema/form-types--sections';
import { FORM_TYPE_STATUSES } from '../aux-schema/form-types--statuses';
import { MaxProcessingDaysSchema } from '../aux-schema/forms--deadlines';
import { FORM_STATUSES, type FormStatus } from '../aux-schema/forms--statuses';
import { StaffRefSchema } from './form';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const FORM_TYPE_ENDPOINTS = {
  /** GET: mọi loại đơn, mỗi loại một dòng theo phiên bản mới nhất → FormTypesResponse (bảng Quản lí loại đơn). Cần quyền manageFormTypes */
  list: '/form-types',
  /** POST: tạo loại đơn với phiên bản 1, body SaveFormTypeVersionRequest → ManagedFormType (201).
      Máy chủ đặt mã loại đơn theo mã đơn. Cần quyền manageFormTypes */
  create: '/form-types',
  /** GET: các loại đơn đang nhận đơn (có phiên bản Đang mở) → OpenFormTypesResponse. Dùng cho hộp "Chọn loại đơn" khi nộp đơn mới */
  open: '/form-types/open',
  /** GET: phiên bản Đang mở của một loại đơn, đủ cấu trúc các phần, câu hỏi → FormType. Dùng cho trang nộp đơn mới.
      Loại đơn không có, hoặc không có phiên bản nào đang mở, thì 404 */
  detail: '/form-types/:formTypeId',
  /** GET: loại đơn kèm mọi phiên bản → ManagedFormType (trình soạn).
      POST: thêm phiên bản mới (chép từ phiên bản đã khóa rồi sửa), body SaveFormTypeVersionRequest → ManagedFormType (201);
      đang có phiên bản Nháp thì 409. Cần quyền manageFormTypes */
  versions: '/form-types/:formTypeId/versions',
  /** PUT: lưu phiên bản Nháp (nội dung; trạng thái Nháp, hoặc Đang mở = mở phiên bản), body SaveFormTypeVersionRequest
      → ManagedFormType; phiên bản đã khóa thì 409.
      DELETE: xóa phiên bản Nháp → ManagedFormType; nếu đó là phiên bản duy nhất thì xóa luôn loại đơn (204).
      Cần quyền manageFormTypes */
  version: '/form-types/:formTypeId/versions/:version',
  /** PUT: mở / đóng phiên bản đã khóa, body SetFormTypeVersionStatusRequest → ManagedFormType; phiên bản Nháp thì 409.
      Cần quyền manageFormTypes */
  versionStatus: '/form-types/:formTypeId/versions/:version/status',
  /** GET: cấu hình thời gian của loại đơn (thời gian xử lí, giờ tự mở, tự đóng) → FormTypeTimeSettings.
      PUT: lưu, body SaveFormTypeTimeSettingsRequest → FormTypeTimeSettings; không tạo phiên bản mới, áp dụng cho mọi phiên bản.
      Sai luật (giờ đóng trước giờ mở, phiên bản không có…) thì 422 với câu của FORM_TYPE_TIME_MESSAGES. Cần quyền manageFormTypes */
  timeSettings: '/form-types/:formTypeId/time-settings',
  /** GET ?<điều kiện thống kê> → FormTypeAnswerStats: thống kê câu trả lời các đơn của loại đơn (thẻ Thống kê ở trình soạn),
      tham số theo formTypeStatsQueryParams; tham số sai thì 422; phiên bản không có thì 404. Cần quyền manageFormTypes */
  stats: '/form-types/:formTypeId/stats',
} as const;

/**
 * Đường dẫn API thống kê câu trả lời của một loại đơn.
 * @param formTypeId  mã loại đơn
 * @returns           vd '/form-types/xmr/stats'
 */
export function formTypeStatsPath(formTypeId: string): string {
  return FORM_TYPE_ENDPOINTS.stats.replace(':formTypeId', encodeURIComponent(formTypeId));
}

/**
 * Đường dẫn API của một loại đơn (phiên bản đang mở).
 * @param formTypeId  mã loại đơn, vd 'xmr'
 * @returns           vd '/form-types/xmr'
 */
export function formTypeDetailPath(formTypeId: string): string {
  return FORM_TYPE_ENDPOINTS.detail.replace(':formTypeId', encodeURIComponent(formTypeId));
}

/**
 * Đường dẫn API các phiên bản của một loại đơn.
 * @param formTypeId  mã loại đơn
 * @returns           vd '/form-types/xmr/versions'
 */
export function formTypeVersionsPath(formTypeId: string): string {
  return FORM_TYPE_ENDPOINTS.versions.replace(':formTypeId', encodeURIComponent(formTypeId));
}

/**
 * Đường dẫn API một phiên bản.
 * @param formTypeId  mã loại đơn
 * @param version     số phiên bản
 * @returns           vd '/form-types/xmr/versions/2'
 */
export function formTypeVersionPath(formTypeId: string, version: number): string {
  return `${formTypeVersionsPath(formTypeId)}/${version}`;
}

/**
 * Đường dẫn API mở / đóng một phiên bản.
 * @param formTypeId  mã loại đơn
 * @param version     số phiên bản
 * @returns           vd '/form-types/xmr/versions/2/status'
 */
export function formTypeVersionStatusPath(formTypeId: string, version: number): string {
  return `${formTypeVersionPath(formTypeId, version)}/status`;
}

/**
 * Đường dẫn API cấu hình thời gian của một loại đơn.
 * @param formTypeId  mã loại đơn
 * @returns           vd '/form-types/xmr/time-settings'
 */
export function formTypeTimeSettingsPath(formTypeId: string): string {
  return FORM_TYPE_ENDPOINTS.timeSettings.replace(':formTypeId', encodeURIComponent(formTypeId));
}

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Một loại đơn đang nhận đơn (theo phiên bản đang mở): đủ để người nộp chọn, chưa có cấu trúc các phần, câu hỏi. */
export const OpenFormTypeSchema = z.object({
  /** Mã loại đơn, vd 'xmr' */
  id: z.string(),
  /** Tên loại đơn, vd 'Thôi học' */
  name: z.string(),
  /** Tiền tố mã đơn, vd 'XMR' (mã đơn XMR-2026-001-00001) */
  prefix: z.string(),
  /** Mô tả ngắn; null = không có */
  description: z.string().nullable(),
});
export type OpenFormType = z.infer<typeof OpenFormTypeSchema>;

/** Trả về từ GET /form-types/open. */
export const OpenFormTypesResponseSchema = z.object({ formTypes: z.array(OpenFormTypeSchema) });
export type OpenFormTypesResponse = z.infer<typeof OpenFormTypesResponseSchema>;

/** Một phiên bản loại đơn để nộp đơn: thông tin chung, số phiên bản, trạng thái và cấu trúc nội dung (các phần → câu hỏi).
    Mỗi lá đơn lưu kèm bản chụp này lúc nộp; số phiên bản nằm trong mã đơn. */
export const FormTypeSchema = OpenFormTypeSchema.extend({
  /** Số phiên bản, vd 2 */
  version: z.number().int().positive().default(1),
  status: z.enum(FORM_TYPE_STATUSES),
  /** Thời gian xử lí tối đa, ngày làm việc; null = không có hạn. Bản chụp đơn cũ chưa có mục này thì null */
  maxProcessingDays: MaxProcessingDaysSchema.default(null),
  sections: z.array(FormSectionSchema),
});
export type FormType = z.infer<typeof FormTypeSchema>;

/** Một phiên bản trong trình soạn: nội dung và lần lưu gần nhất. */
export const FormTypeVersionSchema = z.object({
  version: z.number().int().positive(),
  status: z.enum(FORM_TYPE_STATUSES),
  name: z.string(),
  /** Mô tả ngắn; null = không có */
  description: z.string().nullable(),
  /** Thời gian xử lí tối đa, ngày làm việc; null = không có hạn */
  maxProcessingDays: MaxProcessingDaysSchema,
  sections: z.array(FormSectionSchema),
  /** Lần lưu gần nhất, giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
  updatedAt: z.string(),
  /** Cán bộ lưu lần gần nhất */
  updatedBy: StaffRefSchema,
});
export type FormTypeVersion = z.infer<typeof FormTypeVersionSchema>;

/** Trả về từ GET /form-types/:formTypeId/versions và các lệnh sửa loại đơn: loại đơn kèm mọi phiên bản. */
export const ManagedFormTypeSchema = z.object({
  id: z.string(),
  prefix: z.string(),
  /** true khi đã có phiên bản từng được mở: không đổi mã đơn được nữa */
  prefixLocked: z.boolean(),
  /** Số đơn đã nộp theo loại này (mọi phiên bản) */
  formCount: z.number().int().nonnegative(),
  /** Các phiên bản, mới nhất trước; luôn có ít nhất một */
  versions: z.array(FormTypeVersionSchema).min(1),
});
export type ManagedFormType = z.infer<typeof ManagedFormTypeSchema>;

/** Tóm tắt một phiên bản cũ trong bảng Quản lí loại đơn (dòng xổ ra khi bấm ›). */
export const FormTypeVersionSummarySchema = FormTypeVersionSchema.omit({ sections: true, description: true });
export type FormTypeVersionSummary = z.infer<typeof FormTypeVersionSummarySchema>;

/** Một dòng trong bảng Quản lí loại đơn: mã đơn, thông tin của phiên bản mới nhất, các phiên bản cũ hơn. */
export const FormTypeSummarySchema = OpenFormTypeSchema.extend({
  /** Phiên bản mới nhất (tên, mô tả, trạng thái, lần lưu ở dòng này đều của phiên bản đó) */
  version: z.number().int().positive(),
  status: z.enum(FORM_TYPE_STATUSES),
  updatedAt: z.string(),
  updatedBy: StaffRefSchema,
  /** Số đơn đã nộp theo loại này (mọi phiên bản) */
  formCount: z.number().int().nonnegative(),
  /** Các phiên bản cũ hơn, mới trước; chỉ có một phiên bản thì [] */
  olderVersions: z.array(FormTypeVersionSummarySchema),
});
export type FormTypeSummary = z.infer<typeof FormTypeSummarySchema>;

/** Trả về từ GET /form-types: mọi loại đơn, máy chủ không phân trang (ít loại đơn). */
export const FormTypesResponseSchema = z.object({ formTypes: z.array(FormTypeSummarySchema) });
export type FormTypesResponse = z.infer<typeof FormTypesResponseSchema>;

/** Trạng thái chọn được khi lưu phiên bản Nháp: giữ Nháp, hoặc mở luôn. */
export const DRAFT_SAVE_STATUSES = ['draft', 'open'] as const;
/** Trạng thái chọn được với phiên bản đã khóa. */
export const LOCKED_VERSION_STATUSES = ['open', 'closed'] as const;

/** Gửi lên khi tạo loại đơn, thêm phiên bản hoặc lưu phiên bản Nháp. Mã đơn chỉ đổi được khi chưa khóa.
    Ngoài đúng dạng, máy chủ còn kiểm tra như trình soạn bằng validateFormTypeDraft (validators/form-types.ts). */
export const SaveFormTypeVersionRequestSchema = z.object({
  prefix: z.string(),
  name: z.string().trim().min(1),
  /** Mô tả ngắn; null = không có */
  description: z.string().trim().nullable(),
  /** Thời gian xử lí tối đa, ngày làm việc; null = không có hạn. Khoảng cho phép do validateFormTypeDraft kiểm tra (câu báo như trình soạn) */
  maxProcessingDays: z.number().nullable(),
  /** Nháp: lưu để soạn tiếp · Đang mở: mở phiên bản này (phiên bản đang mở khác tự đóng) */
  status: z.enum(DRAFT_SAVE_STATUSES),
  sections: z.array(FormSectionSchema).min(1),
});
export type SaveFormTypeVersionRequest = z.infer<typeof SaveFormTypeVersionRequestSchema>;

/** Gửi lên khi mở / đóng phiên bản đã khóa. Mở thì phiên bản đang mở khác tự đóng. */
export const SetFormTypeVersionStatusRequestSchema = z.object({ status: z.enum(LOCKED_VERSION_STATUSES) });
export type SetFormTypeVersionStatusRequest = z.infer<typeof SetFormTypeVersionStatusRequestSchema>;

/* ---------- Cấu hình thời gian (nút đồng hồ ở trình soạn) ----------
   Thuộc loại đơn, áp dụng cho mọi phiên bản; sửa không tạo phiên bản mới.
   - Thời gian xử lí tối đa: đơn chụp giá trị lúc nộp, sửa chỉ áp dụng cho đơn nộp sau đó.
   - Một giờ tự mở (kèm phiên bản sẽ mở, chọn được cả bản Nháp) và một giờ tự đóng; không phải danh sách, hẹn đợt mới thì sửa giờ cũ.
   - Chạy xong chỉ đánh dấu đã chạy (done), giờ vẫn giữ; sửa sang giờ khác thì bỏ dấu.
   Luật chạy: business-rules/form-types--schedule.ts. Kiểm tra: validateFormTypeTimeSettings (validators/form-types.ts). */

/**
 * Chuỗi có phải phút có thật, giờ Việt Nam dạng 'YYYY-MM-DDTHH:mm' không.
 * @param text  chuỗi
 * @returns     true nếu đúng dạng và có thật (vd '2026-02-30T08:00', '2026-12-01T24:00' là sai)
 */
export function isVietnamMinute(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 16) === text;
}

/** Giờ hẹn: phút có thật, giờ Việt Nam 'YYYY-MM-DDTHH:mm'. */
const ScheduleMinuteSchema = z.string().refine(isVietnamMinute, 'Giờ hẹn phải có dạng ngày giờ hợp lệ.');

/** Giờ tự mở: lúc mở, phiên bản sẽ mở, đã chạy chưa. */
export const AutoOpenSchema = z.object({
  /** Giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
  at: ScheduleMinuteSchema,
  /** Phiên bản sẽ mở (Nháp, Đang mở hoặc Đã đóng) */
  version: z.number().int().positive(),
  /** true = đã tới giờ và đã chạy ("✓ đã mở") */
  done: z.boolean(),
});
export type AutoOpen = z.infer<typeof AutoOpenSchema>;

/** Giờ tự đóng: đóng phiên bản đang mở. */
export const AutoCloseSchema = z.object({
  /** Giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
  at: ScheduleMinuteSchema,
  /** true = đã tới giờ và đã chạy ("✓ đã đóng") */
  done: z.boolean(),
});
export type AutoClose = z.infer<typeof AutoCloseSchema>;

/** Trả về từ GET / PUT /form-types/:formTypeId/time-settings. */
export const FormTypeTimeSettingsSchema = z.object({
  /** Thời gian xử lí tối đa, ngày làm việc; null = không có hạn */
  maxProcessingDays: MaxProcessingDaysSchema,
  /** null = không hẹn giờ mở */
  autoOpen: AutoOpenSchema.nullable(),
  /** null = không hẹn giờ đóng */
  autoClose: AutoCloseSchema.nullable(),
});
export type FormTypeTimeSettings = z.infer<typeof FormTypeTimeSettingsSchema>;

/** Cấu hình thời gian khi loại đơn chưa đặt gì. */
export const EMPTY_FORM_TYPE_TIME_SETTINGS: FormTypeTimeSettings = { maxProcessingDays: null, autoOpen: null, autoClose: null };

/** Gửi lên khi lưu cấu hình thời gian. Dấu đã chạy do máy chủ giữ hoặc bỏ (timeSettingsAfterSave), không gửi lên.
    Ngoài đúng dạng, máy chủ còn kiểm tra như khung Cấu hình thời gian bằng validateFormTypeTimeSettings. */
export const SaveFormTypeTimeSettingsRequestSchema = z.object({
  /** Khoảng cho phép do validateFormTypeTimeSettings kiểm tra (câu báo như trình soạn) */
  maxProcessingDays: z.number().nullable(),
  autoOpen: AutoOpenSchema.omit({ done: true }).nullable(),
  autoClose: AutoCloseSchema.omit({ done: true }).nullable(),
});
export type SaveFormTypeTimeSettingsRequest = z.infer<typeof SaveFormTypeTimeSettingsRequestSchema>;

/* ---------- Thống kê câu trả lời (thẻ Thống kê) ----------
   GET /form-types/:formTypeId/stats?version=2&submittedFrom=2026-09-01&submittedTo=2026-11-30&statuses=nop,xet
   - version: số phiên bản hoặc 'all' (mặc định) · submittedFrom, submittedTo: khoảng ngày nộp, tính cả hai đầu
   - statuses: các trạng thái cách nhau bởi dấu phẩy; bỏ trống = mọi trạng thái
   Điều kiện chỉ quyết định đơn nào được đếm; cách chia nhóm biểu đồ theo luật ở business-rules/form-types--answer-stats.ts. */

/** Ngày dạng 'YYYY-MM-DD'. */
const StatsDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD.');

/** Điều kiện thống kê: đơn nào được đếm. */
export const FormTypeStatsQuerySchema = z
  .object({
    /** Số phiên bản, hoặc 'all' = mọi phiên bản */
    version: z.union([z.number().int().positive(), z.literal('all')]),
    /** Từ ngày nộp (tính cả ngày này); null = không giới hạn */
    submittedFrom: StatsDaySchema.nullable(),
    /** Đến ngày nộp (tính cả ngày này); null = không giới hạn */
    submittedTo: StatsDaySchema.nullable(),
    /** Các trạng thái được đếm; [] = mọi trạng thái */
    statuses: z.array(z.enum(FORM_STATUSES)),
  })
  .refine((query) => !query.submittedFrom || !query.submittedTo || query.submittedFrom <= query.submittedTo, {
    message: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
    path: ['submittedTo'],
  });
export type FormTypeStatsQuery = z.infer<typeof FormTypeStatsQuerySchema>;

/** Điều kiện mặc định: mọi phiên bản, mọi ngày, mọi trạng thái. */
export const DEFAULT_FORM_TYPE_STATS_QUERY: FormTypeStatsQuery = { version: 'all', submittedFrom: null, submittedTo: null, statuses: [] };

/**
 * Ghi điều kiện thống kê thành tham số trên đường dẫn (trình duyệt gọi); bỏ tham số trống cho gọn.
 * @param query  điều kiện thống kê
 * @returns      tham số, vd { version: '2', statuses: 'nop,xet' }
 */
export function formTypeStatsQueryParams(query: FormTypeStatsQuery): Record<string, string> {
  const params: Record<string, string> = { version: String(query.version) };
  if (query.submittedFrom) params.submittedFrom = query.submittedFrom;
  if (query.submittedTo) params.submittedTo = query.submittedTo;
  if (query.statuses.length) params.statuses = query.statuses.join(',');
  return params;
}

/**
 * Đọc điều kiện thống kê từ tham số trên đường dẫn (máy chủ, API giả gọi).
 * @param params  tham số đọc từ đường dẫn
 * @returns       điều kiện thống kê; sai dạng thì null (422)
 */
export function parseFormTypeStatsQueryParams(params: Record<string, string | undefined>): FormTypeStatsQuery | null {
  // Tham số lặp lại (vd ?statuses=nop&statuses=xet) thì máy chủ đọc ra mảng: coi là sai dạng
  const paramNames = ['version', 'submittedFrom', 'submittedTo', 'statuses'] as const;
  if (paramNames.some((name) => params[name] !== undefined && typeof params[name] !== 'string')) return null;

  const versionText = params.version || 'all';
  const parsed = FormTypeStatsQuerySchema.safeParse({
    version: versionText === 'all' ? 'all' : Number(versionText),
    submittedFrom: params.submittedFrom || null,
    submittedTo: params.submittedTo || null,
    statuses: params.statuses ? params.statuses.split(',') : [],
  });
  return parsed.success ? parsed.data : null;
}

/** Số câu Trả lời ngắn (cột Chữ) nhiều nhất trả về; còn lại chỉ đếm vào distinctCount. */
export const ANSWER_STATS_TEXT_LIMIT = 50;
/** Số câu Đoạn văn mới nhất trả về. */
export const ANSWER_STATS_PARAGRAPH_LIMIT = 20;

/** Một nhóm có tên và số đếm: một lựa chọn, một cột biểu đồ, một đuôi tệp. */
export const CountedLabelSchema = z.object({ label: z.string(), count: z.number().int().nonnegative() });
export type CountedLabel = z.infer<typeof CountedLabelSchema>;

/** Câu Chọn một, Chọn nhiều, Danh sách thả xuống, cột Chọn: số lần mỗi lựa chọn được chọn.
    Lựa chọn của câu hỏi theo thứ tự soạn (kể cả lựa chọn chưa ai chọn), rồi các giá trị khác (vd lựa chọn của phiên bản cũ), nhiều trước. */
const OptionStatsSchema = z.object({ kind: z.literal('options'), options: z.array(CountedLabelSchema) });

/** Câu Số, cột Số: nhỏ nhất, trung bình, lớn nhất (null khi chưa ai trả lời) và các cột biểu đồ. */
const NumberStatsSchema = z.object({
  kind: z.literal('number'),
  min: z.number().nullable(),
  average: z.number().nullable(),
  max: z.number().nullable(),
  bins: z.array(CountedLabelSchema),
});

/** Câu Ngày, cột Ngày: ngày sớm nhất, muộn nhất ('YYYY-MM-DD', null khi chưa ai trả lời) và các cột biểu đồ. */
const DateStatsSchema = z.object({
  kind: z.literal('date'),
  earliest: StatsDaySchema.nullable(),
  latest: StatsDaySchema.nullable(),
  bins: z.array(CountedLabelSchema),
});

/** Câu Trả lời ngắn, cột Chữ: câu trả lời gộp câu trùng, nhiều trước, tối đa ANSWER_STATS_TEXT_LIMIT câu. */
const TextStatsSchema = z.object({
  kind: z.literal('text'),
  /** Số câu trả lời khác nhau (kể cả những câu không trả về) */
  distinctCount: z.number().int().nonnegative(),
  answers: z.array(z.object({ text: z.string(), count: z.number().int().positive() })),
});

/** Câu Đoạn văn: các câu trả lời mới nhất, tối đa ANSWER_STATS_PARAGRAPH_LIMIT câu. */
const ParagraphStatsSchema = z.object({
  kind: z.literal('para'),
  answers: z.array(
    z.object({
      formCode: z.string(),
      /** Lúc nộp, giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
      submittedAt: z.string(),
      /** Câu trả lời dạng chữ thường */
      text: z.string(),
    }),
  ),
});

/** Câu Tải tệp: tổng số tệp và số tệp theo đuôi (in hoa, vd 'PDF'), nhiều trước. */
const FileStatsSchema = z.object({
  kind: z.literal('file'),
  fileCount: z.number().int().nonnegative(),
  byExtension: z.array(CountedLabelSchema),
});

/** Thống kê một cột của bảng nhiều dòng, theo kiểu cột. */
const ColumnAnswerStatsSchema = z.discriminatedUnion('kind', [OptionStatsSchema, NumberStatsSchema, DateStatsSchema, TextStatsSchema]);

/** Một cột của bảng nhiều dòng; cột cùng tên ở các phiên bản gộp làm một. */
const TableColumnStatsSchema = z.object({
  label: z.string(),
  type: z.enum(TABLE_COLUMN_TYPES),
  /** Số dòng có điền ô này */
  answered: z.number().int().nonnegative(),
  stats: ColumnAnswerStatsSchema,
});
export type TableColumnStats = z.infer<typeof TableColumnStatsSchema>;

/** Câu Bảng nhiều dòng: tổng số dòng và thống kê từng cột. */
const TableStatsSchema = z.object({
  kind: z.literal('table'),
  rowCount: z.number().int().nonnegative(),
  columns: z.array(TableColumnStatsSchema),
});

/** Thống kê theo loại câu hỏi. */
export const AnswerStatsSchema = z.discriminatedUnion('kind', [
  OptionStatsSchema,
  NumberStatsSchema,
  DateStatsSchema,
  TextStatsSchema,
  ParagraphStatsSchema,
  FileStatsSchema,
  TableStatsSchema,
]);
export type AnswerStats = z.infer<typeof AnswerStatsSchema>;
/** Thống kê theo kiểu, vd AnswerStatsOf<'number'> có min, max, bins. */
export type AnswerStatsOf<Kind extends AnswerStats['kind']> = AnswerStats & { kind: Kind };

/** Loại câu hỏi có thống kê (mọi loại trừ khối thông báo). */
const STATS_QUESTION_TYPES = QUESTION_TYPES.filter((type): type is Exclude<QuestionType, 'info'> => type !== 'info');

/** Thống kê một câu hỏi. */
export const QuestionStatsSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(STATS_QUESTION_TYPES as [Exclude<QuestionType, 'info'>, ...Exclude<QuestionType, 'info'>[]]),
  required: z.boolean(),
  /** Số đơn có trả lời câu này */
  answered: z.number().int().nonnegative(),
  /** Số đơn được đếm có câu này (đơn của phiên bản không có câu này thì không tính) */
  formCount: z.number().int().nonnegative(),
  /** Các phiên bản có câu này, khi không phải mọi phiên bản đang thống kê đều có; null = mọi phiên bản đều có */
  onlyInVersions: z.array(z.number().int().positive()).nullable(),
  stats: AnswerStatsSchema,
});
export type QuestionStats = z.infer<typeof QuestionStatsSchema>;

/** Trả về từ GET /form-types/:formTypeId/stats. */
export const FormTypeAnswerStatsSchema = z.object({
  /** Số đơn được thống kê (theo mọi điều kiện) */
  total: z.number().int().nonnegative(),
  /** Số đơn theo trạng thái, theo phiên bản và ngày nộp nhưng chưa lọc trạng thái (số trên các nút trạng thái) */
  byStatus: z.object(
    Object.fromEntries(FORM_STATUSES.map((status) => [status, z.number().int().min(0)])) as Record<FormStatus, z.ZodNumber>,
  ),
  /** Các phần theo thứ tự soạn của phiên bản mới nhất (phần, câu chỉ có ở phiên bản cũ chen vào đúng chỗ); bỏ khối thông báo, phần không có câu hỏi */
  sections: z.array(z.object({ id: z.string(), title: z.string(), questions: z.array(QuestionStatsSchema) })),
});
export type FormTypeAnswerStats = z.infer<typeof FormTypeAnswerStatsSchema>;

/* ---------- Câu thông báo ---------- */

export const FORM_TYPE_MESSAGES = {
  /** Gọi API khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
  /** GET /form-types khi vai trò không có quyền manageFormTypes (403) */
  403: 'Bạn không có quyền quản lí loại đơn.',
  /** Bấm "Nộp đơn mới" khi không có loại đơn nào đang mở */
  noneOpen: 'Hiện chưa có loại đơn nào đang nhận đơn.',
  /** Mở trang nộp đơn của loại đơn không có, hoặc không còn nhận đơn */
  404: 'Loại đơn này không có hoặc đã ngừng nhận đơn.',
  /** Các lệnh của trình soạn khi loại đơn không còn (vd người khác vừa xóa) (404) */
  notFound: 'Loại đơn này không còn. Có thể ai đó vừa xóa.',
  /** Lệnh với một phiên bản không còn (404) */
  versionNotFound: 'Phiên bản này không còn. Có thể ai đó vừa xóa.',
  /** POST / PUT khi body sai định dạng (422). Bản soạn chưa hợp lệ thì báo bằng FORM_TYPE_DRAFT_MESSAGES */
  invalidRequest: 'Dữ liệu loại đơn không hợp lệ.',
  /** Đổi mã đơn khi đã có phiên bản từng được mở (409) */
  prefixLocked: 'Loại đơn đã phát hành nên không đổi được mã đơn.',
  /** PUT nội dung vào phiên bản đã khóa (409) */
  versionLocked: 'Phiên bản này đã phát hành nên không sửa được. Thay đổi phải lưu thành phiên bản mới.',
  /** POST phiên bản mới khi đang có phiên bản Nháp (409) */
  draftExists: (version: number) => `Loại đơn này đang có phiên bản ${version} là nháp. Hãy soạn tiếp ở phiên bản đó.`,
  /** DELETE phiên bản đã khóa (409) */
  onlyDraftDeletable: 'Chỉ xóa được phiên bản nháp.',
  /** PUT trạng thái của phiên bản Nháp (409) */
  draftNotLocked: 'Phiên bản này còn là nháp. Chọn Đang mở rồi bấm Lưu để mở.',
  /** Lưu xong, vd "Đã lưu phiên bản 2 của Thôi học (Nháp)." */
  saved: (name: string, version: number, statusLabel: string) => `Đã lưu phiên bản ${version} của ${name} (${statusLabel}).`,
  /** Mở xong; có phiên bản đang mở khác thì nhắc nó đã tự đóng */
  opened: (name: string, version: number, closedVersion: number | null) =>
    `Đã mở phiên bản ${version} của ${name}.${closedVersion ? ` Phiên bản ${closedVersion} tự chuyển sang Đã đóng.` : ''}`,
  /** Đóng xong */
  closed: (name: string, version: number) => `Đã đóng phiên bản ${version} của ${name}. Loại đơn ngừng nhận đơn mới.`,
  /** Xóa phiên bản Nháp xong */
  draftDeleted: (version: number) => `Đã xóa phiên bản nháp ${version}.`,
  /** Xóa phiên bản duy nhất (xóa luôn loại đơn) xong */
  deleted: (name: string) => `Đã xóa loại đơn ${name}.`,
  /** GET /form-types/:formTypeId/stats với tham số sai (422) */
  invalidStatsQuery: 'Điều kiện thống kê không hợp lệ.',
  /** Bấm Bỏ thay đổi */
  discarded: 'Đã bỏ các thay đổi chưa lưu.',
} as const;

/** Câu thông báo của cấu hình thời gian. */
export const FORM_TYPE_TIME_MESSAGES = {
  /** Giờ đóng không sau giờ mở */
  closeBeforeOpen: 'Giờ tự đóng phải sau giờ tự mở.',
  /** Giờ hẹn mới hoặc vừa sửa không sau thời điểm hiện tại */
  inThePast: 'Giờ hẹn đã qua, chọn giờ sau thời điểm hiện tại.',
  /** Phiên bản tự mở không có (vd vừa xóa bản Nháp) */
  versionMissing: (version: number) => `Loại đơn không có phiên bản ${version}. Chọn lại phiên bản sẽ mở.`,
  /** Lưu xong */
  saved: (name: string) => `Đã lưu cấu hình thời gian của ${name}.`,
} as const;
