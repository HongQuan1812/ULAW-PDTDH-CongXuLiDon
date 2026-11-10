/* HỢP ĐỒNG nhóm API NHIỀU lá đơn: các bảng đơn (đơn mình đã nộp, đơn phụ trách, Quản lí đơn) và CCCD người nộp.
   Một lá đơn (nộp, chi tiết, sửa, xử lí) nằm ở form.ts.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import { FormSummarySchema, StaffRefSchema } from './form';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const FORMS_ENDPOINTS = {
  /** GET: mọi đơn của mọi người nộp → ManagedFormsResponse (bảng ở trang Quản lí đơn). Cần quyền viewAll.
      CCCD người nộp trả dạng che; muốn xem đủ thì gọi cccds */
  list: '/forms',
  /** GET: CCCD đầy đủ của mọi người nộp đơn → FormCccdsResponse (nút "Hiện CCCD" ở trang Quản lí đơn). Cần quyền viewApplicant */
  cccds: '/forms/cccds',
  /** GET: các đơn mình đã nộp → MyFormsResponse (bảng "Đơn đã nộp" trên trang Thông tin cá nhân) */
  mine: '/forms/mine',
  /** GET: các đơn mình là người tiếp nhận hoặc người xử lí → HandledFormsResponse (mục "Đơn phụ trách"). Cần quyền decide */
  handled: '/forms/handled',
} as const;

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Trả về từ GET /forms/mine: mọi đơn của mình, máy chủ không phân trang (mỗi người ít đơn). */
export const MyFormsResponseSchema = z.object({ forms: z.array(FormSummarySchema) });
export type MyFormsResponse = z.infer<typeof MyFormsResponseSchema>;

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

/** Người nộp đơn ở một dòng của bảng Quản lí đơn: họ tên, email, SĐT và CCCD (che). */
export const ManagedApplicantSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  /** Số điện thoại; null = chưa có */
  phone: z.string().nullable(),
  /** CCCD đã che (vd '079•••••••01'); null = chưa có */
  maskedCccd: z.string().nullable(),
});
export type ManagedApplicant = z.infer<typeof ManagedApplicantSchema>;

/** Một dòng trong bảng Quản lí đơn: thông tin chính của đơn, lúc tiếp nhận và thông tin người nộp. */
export const ManagedFormSummarySchema = FormSummarySchema.extend({
  /** Lúc tiếp nhận gần nhất, giờ Việt Nam 'YYYY-MM-DDTHH:mm'; null = chưa tiếp nhận */
  receivedAt: z.string().nullable(),
  applicant: ManagedApplicantSchema,
});
export type ManagedFormSummary = z.infer<typeof ManagedFormSummarySchema>;

/** Trả về từ GET /forms: mọi đơn, máy chủ không phân trang (bảng tự tìm, lọc, sắp xếp, chia trang). */
export const ManagedFormsResponseSchema = z.object({ forms: z.array(ManagedFormSummarySchema) });
export type ManagedFormsResponse = z.infer<typeof ManagedFormsResponseSchema>;

/** Trả về từ GET /forms/cccds: CCCD đầy đủ theo id người nộp (người chưa có CCCD thì không có mặt). */
export const FormCccdsResponseSchema = z.object({ cccds: z.record(z.string(), z.string()) });
export type FormCccdsResponse = z.infer<typeof FormCccdsResponseSchema>;

/* ---------- Câu thông báo ---------- */

export const FORMS_MESSAGES = {
  /** Gọi API khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
  /** GET /forms/handled khi vai trò không được xử lí đơn (không có quyền decide) */
  handledForbidden: 'Bạn không có quyền xem đơn phụ trách.',
  /** GET /forms khi vai trò không được xem mọi đơn (không có quyền viewAll) */
  listForbidden: 'Bạn không có quyền xem tất cả đơn.',
  /** GET /forms/cccds khi vai trò không được xem hồ sơ người nộp đơn (không có quyền viewApplicant) */
  cccdsForbidden: 'Bạn không có quyền xem CCCD người nộp đơn.',
} as const;
