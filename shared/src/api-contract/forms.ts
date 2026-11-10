/* HỢP ĐỒNG nhóm API lá đơn: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này.
   Quy ước tên: form = lá đơn sinh viên nộp · form type = loại đơn (mẫu do cán bộ soạn). */
import { z } from 'zod';
import { FormSectionSchema } from '../aux-schema/form-types--sections';
import { FormAnswersSchema } from '../aux-schema/forms--answers';
import { FORM_STATUSES } from '../aux-schema/forms--statuses';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const FORM_ENDPOINTS = {
  /** POST (multipart/form-data, xem SUBMIT_FORM_FIELDS) → FormSummary (201): nộp đơn mới, gửi câu trả lời và mọi tệp trong MỘT lần.
      Cần quyền submit. Máy chủ kiểm tra hết (câu trả lời, ô cam đoan, từng tệp); sai một chỗ thì trả lỗi và KHÔNG lưu gì.
      Đúng hết thì sinh mã đơn, lưu đơn kèm bản chụp cấu trúc loại đơn lúc nộp và lưu các tệp */
  submit: '/forms',
  /** GET: các đơn mình đã nộp → MyFormsResponse (bảng "Đơn đã nộp" trên trang Thông tin cá nhân) */
  mine: '/forms/mine',
  /** GET: các đơn mình là người tiếp nhận hoặc người xử lí → HandledFormsResponse (mục "Đơn phụ trách"). Cần quyền decide */
  handled: '/forms/handled',
  /** GET: một lá đơn, đủ nội dung → FormDetail (trang chi tiết đơn, xem nhanh).
      Xem được: người nộp đơn, hoặc cán bộ có quyền viewAll. Không có đơn, hoặc không được xem, đều trả 404 */
  detail: '/forms/:code',
} as const;

/**
 * Đường dẫn API của một lá đơn.
 * @param code  mã đơn, vd 'XMM-2026-00001'
 * @returns     vd '/forms/XMM-2026-00001'
 */
export function formDetailPath(code: string): string {
  return FORM_ENDPOINTS.detail.replace(':code', encodeURIComponent(code));
}

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Một dòng trong bảng đơn: các cột thông tin chính của lá đơn, chưa có nội dung đơn. */
export const FormSummarySchema = z.object({
  /** Mã đơn, vd 'XMM-2026-00001' */
  code: z.string(),
  /** Mã loại đơn, vd 'xmm' */
  formTypeId: z.string(),
  /** Tên loại đơn lúc nộp, vd 'Xét miễn môn' */
  formTypeName: z.string(),
  /** Lúc nộp, giờ Việt Nam, dạng 'YYYY-MM-DDTHH:mm' */
  submittedAt: z.string(),
  status: z.enum(FORM_STATUSES),
});
export type FormSummary = z.infer<typeof FormSummarySchema>;

/** Trả về từ GET /forms/mine: mọi đơn của mình, máy chủ không phân trang (mỗi người ít đơn). */
export const MyFormsResponseSchema = z.object({ forms: z.array(FormSummarySchema) });
export type MyFormsResponse = z.infer<typeof MyFormsResponseSchema>;

/** Cán bộ gắn với một lá đơn (người tiếp nhận, người xử lí). */
export const StaffRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});
export type StaffRef = z.infer<typeof StaffRefSchema>;

/** Một dòng trong bảng "Đơn phụ trách": thông tin chính của đơn, kèm người tiếp nhận và người xử lí. */
export const HandledFormSummarySchema = FormSummarySchema.extend({
  /** Cán bộ đã bấm "Tiếp nhận"; null = chưa tiếp nhận */
  receiver: StaffRefSchema.nullable(),
  /** Cán bộ đang xử lí (khác người tiếp nhận nếu đơn đã được chuyển giao); null = chưa tiếp nhận */
  handler: StaffRefSchema.nullable(),
});
export type HandledFormSummary = z.infer<typeof HandledFormSummarySchema>;

/** Trả về từ GET /forms/handled: mọi đơn mình tiếp nhận hoặc đang xử lí, không phân trang. */
export const HandledFormsResponseSchema = z.object({ forms: z.array(HandledFormSummarySchema) });
export type HandledFormsResponse = z.infer<typeof HandledFormsResponseSchema>;

/** Người nộp đơn, hiện trong khung "Thông tin đơn". */
export const ApplicantRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});
export type ApplicantRef = z.infer<typeof ApplicantRefSchema>;

/** Trả về từ GET /forms/:code: một lá đơn đủ nội dung, đủ để vẽ trang chi tiết đơn. */
export const FormDetailSchema = FormSummarySchema.extend({
  /** Lần lưu gần nhất (nộp, sửa, bổ sung), giờ Việt Nam 'YYYY-MM-DDTHH:mm'; chưa sửa lần nào thì bằng submittedAt */
  updatedAt: z.string(),
  /** Lí do Phòng Đào tạo ghi khi Yêu cầu bổ sung / Từ chối; "" = không có */
  note: z.string(),
  applicant: ApplicantRefSchema,
  /** Cán bộ đã bấm "Tiếp nhận" và lúc tiếp nhận; null = chưa tiếp nhận */
  receiver: StaffRefSchema.nullable(),
  receivedAt: z.string().nullable(),
  /** Cán bộ đang xử lí và phụ trách từ lúc nào (đổi khi chuyển giao); null = chưa tiếp nhận */
  handler: StaffRefSchema.nullable(),
  handlerSince: z.string().nullable(),
  /** Các phần, câu hỏi của loại đơn LÚC NỘP (bản chụp), để sửa loại đơn sau này không làm hỏng đơn cũ */
  sections: z.array(FormSectionSchema),
  /** Câu trả lời theo id câu hỏi */
  answers: FormAnswersSchema,
});
export type FormDetail = z.infer<typeof FormDetailSchema>;

/**
 * Phần chữ của POST /forms (trường SUBMIT_FORM_FIELDS.request, dạng chuỗi JSON).
 * Câu trả lời của câu hỏi tải tệp là các FileRef có id tạm do trình duyệt đặt (vd 'local-…');
 * nội dung từng tệp gửi kèm trong cùng body, ở trường có tên đúng bằng id đó.
 * Máy chủ lấy tên, dung lượng theo tệp thật nhận được và đặt id mới cho tệp khi lưu.
 */
export const SubmitFormRequestSchema = z.object({
  /** Mã loại đơn, vd 'xmm' */
  formTypeId: z.string().min(1),
  /** Câu trả lời theo id câu hỏi */
  answers: FormAnswersSchema,
  /** Người nộp đã đánh dấu ô cam đoan "các thông tin và minh chứng trên là đúng sự thật" */
  committed: z.boolean(),
});
export type SubmitFormRequest = z.infer<typeof SubmitFormRequestSchema>;

/** Các trường trong body multipart của POST /forms. Ngoài trường request, mỗi tệp là một trường tên bằng id tạm của tệp. */
export const SUBMIT_FORM_FIELDS = {
  /** Chuỗi JSON theo SubmitFormRequestSchema */
  request: 'request',
} as const;

/* ---------- Câu thông báo ---------- */

export const FORM_MESSAGES = {
  /** Gọi API khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
  /** GET /forms/handled khi vai trò không được xử lí đơn (không có quyền decide) */
  403: 'Bạn không có quyền xem đơn phụ trách.',
  /** POST /forms khi vai trò không được nộp đơn (không có quyền submit) */
  submitForbidden: 'Bạn không có quyền nộp đơn.',
  /** POST /forms khi loại đơn không có hoặc không còn nhận đơn (404) */
  formTypeClosed: 'Loại đơn này không có hoặc đã ngừng nhận đơn.',
  /** POST /forms khi body sai định dạng (422). Câu trả lời sai, chưa cam đoan, tệp thiếu / sai / thừa thì báo bằng ANSWER_MESSAGES */
  invalidBody: 'Dữ liệu đơn không hợp lệ.',
  /** GET /forms/:code khi không có đơn, hoặc không được xem đơn này (404; không nói rõ để không lộ mã đơn của người khác) */
  notFound: 'Không có đơn này, hoặc bạn không có quyền xem.',
  /** Nộp đơn xong (toast), vd "Đã nộp đơn XMM-2026-01521." */
  submitted: (code: string) => `Đã nộp đơn ${code}.`,
} as const;
