/* HỢP ĐỒNG nhóm API lá đơn: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này.
   Quy ước tên: form = lá đơn sinh viên nộp · form type = loại đơn (mẫu do cán bộ soạn). */
import { z } from 'zod';
import { FORM_STATUSES } from '../status';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const FORM_ENDPOINTS = {
  /** GET: các đơn mình đã nộp → MyFormsResponse (bảng "Đơn đã nộp" trên trang Thông tin cá nhân) */
  mine: '/forms/mine',
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

/* ---------- Câu thông báo, theo mã HTTP ---------- */

export const FORM_MESSAGES = {
  /** Gọi API khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
} as const;
