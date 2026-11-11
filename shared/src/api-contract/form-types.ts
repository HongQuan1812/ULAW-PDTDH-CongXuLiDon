/* HỢP ĐỒNG nhóm API loại đơn: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này.
   Quy ước tên: form = lá đơn sinh viên nộp · form type = loại đơn (mẫu do cán bộ soạn). */
import { z } from 'zod';
import { FormSectionSchema } from '../aux-schema/form-types--sections';
import { FORM_TYPE_STATUSES } from '../aux-schema/form-types--statuses';
import { StaffRefSchema } from './form';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const FORM_TYPE_ENDPOINTS = {
  /** GET: mọi loại đơn (Nháp, Đang mở, Đã đóng) → FormTypesResponse (bảng trang Quản lí loại đơn). Cần quyền manageFormTypes */
  list: '/form-types',
  /** GET: các loại đơn "Đang mở" (đang nhận đơn) → OpenFormTypesResponse. Dùng cho hộp "Chọn loại đơn" khi nộp đơn mới */
  open: '/form-types/open',
  /** GET: một loại đơn, đủ cấu trúc các phần, câu hỏi → FormType. Dùng cho trang nộp đơn mới.
      Người không quản lí loại đơn chỉ lấy được loại đơn Đang mở; loại khác trả 404 */
  detail: '/form-types/:formTypeId',
} as const;

/**
 * Đường dẫn API của một loại đơn.
 * @param formTypeId  mã loại đơn, vd 'xmm'
 * @returns           vd '/form-types/xmm'
 */
export function formTypeDetailPath(formTypeId: string): string {
  return FORM_TYPE_ENDPOINTS.detail.replace(':formTypeId', encodeURIComponent(formTypeId));
}

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Một loại đơn đang nhận đơn: đủ để người nộp chọn, chưa có cấu trúc các phần, câu hỏi. */
export const OpenFormTypeSchema = z.object({
  /** Mã loại đơn, vd 'xmm' */
  id: z.string(),
  /** Tên loại đơn, vd 'Xét miễn môn' */
  name: z.string(),
  /** Tiền tố mã đơn, vd 'XMM' (mã đơn XMM-2026-00001) */
  prefix: z.string(),
  /** Mô tả ngắn; null = không có */
  description: z.string().nullable(),
});
export type OpenFormType = z.infer<typeof OpenFormTypeSchema>;

/** Trả về từ GET /form-types/open. */
export const OpenFormTypesResponseSchema = z.object({ formTypes: z.array(OpenFormTypeSchema) });
export type OpenFormTypesResponse = z.infer<typeof OpenFormTypesResponseSchema>;

/** Loại đơn đầy đủ: thông tin chung, trạng thái và cấu trúc nội dung (các phần → câu hỏi). */
export const FormTypeSchema = OpenFormTypeSchema.extend({
  status: z.enum(FORM_TYPE_STATUSES),
  sections: z.array(FormSectionSchema),
});
export type FormType = z.infer<typeof FormTypeSchema>;

/** Một dòng trong bảng Quản lí loại đơn: thông tin chung, trạng thái, lần lưu gần nhất; chưa có cấu trúc các phần. */
export const FormTypeSummarySchema = OpenFormTypeSchema.extend({
  status: z.enum(FORM_TYPE_STATUSES),
  /** Lần lưu gần nhất, giờ Việt Nam 'YYYY-MM-DDTHH:mm' */
  updatedAt: z.string(),
  /** Cán bộ lưu lần gần nhất */
  updatedBy: StaffRefSchema,
});
export type FormTypeSummary = z.infer<typeof FormTypeSummarySchema>;

/** Trả về từ GET /form-types: mọi loại đơn, máy chủ không phân trang (ít loại đơn). */
export const FormTypesResponseSchema = z.object({ formTypes: z.array(FormTypeSummarySchema) });
export type FormTypesResponse = z.infer<typeof FormTypesResponseSchema>;

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
} as const;
