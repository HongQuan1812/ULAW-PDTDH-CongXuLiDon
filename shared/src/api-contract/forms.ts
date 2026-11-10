/* HỢP ĐỒNG nhóm API lá đơn: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này.
   Quy ước tên: form = lá đơn sinh viên nộp · form type = loại đơn (mẫu do cán bộ soạn). */
import { z } from 'zod';
import { FORM_STATUSES } from '../status';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const FORM_ENDPOINTS = {
  /** GET: các đơn mình đã nộp → MyFormsResponse (bảng "Đơn đã nộp" trên trang Thông tin cá nhân) */
  mine: '/forms/mine',
  /** GET: các đơn mình là người tiếp nhận hoặc người xử lí → HandledFormsResponse (mục "Đơn phụ trách"). Cần quyền decide */
  handled: '/forms/handled',
} as const;

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

/* ---------- Câu thông báo, theo mã HTTP ---------- */

export const FORM_MESSAGES = {
  /** Gọi API khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
  /** GET /forms/handled khi vai trò không được xử lí đơn (không có quyền decide) */
  403: 'Bạn không có quyền xem đơn phụ trách.',
} as const;
