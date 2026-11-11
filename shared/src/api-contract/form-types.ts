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
  /** POST: tạo loại đơn, body SaveFormTypeRequest → FormType (201). Máy chủ đặt mã loại đơn theo mã đơn. Cần quyền manageFormTypes */
  create: '/form-types',
  /** GET: các loại đơn "Đang mở" (đang nhận đơn) → OpenFormTypesResponse. Dùng cho hộp "Chọn loại đơn" khi nộp đơn mới */
  open: '/form-types/open',
  /** GET: một loại đơn, đủ cấu trúc các phần, câu hỏi → FormType. Dùng cho trang nộp đơn mới.
      Người không quản lí loại đơn chỉ lấy được loại đơn Đang mở; loại khác trả 404.
      Cùng đường dẫn này:
        PUT: lưu loại đơn, body SaveFormTypeRequest → FormType. Cần quyền manageFormTypes
        DELETE: xóa loại đơn chưa có đơn nào (204). Cần quyền manageFormTypes */
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
  /** Số đơn đã nộp theo loại này. Có đơn rồi thì không đổi mã đơn, không xóa loại đơn được */
  formCount: z.number().int().nonnegative(),
});
export type FormTypeSummary = z.infer<typeof FormTypeSummarySchema>;

/** Trả về từ GET /form-types: mọi loại đơn, máy chủ không phân trang (ít loại đơn). */
export const FormTypesResponseSchema = z.object({ formTypes: z.array(FormTypeSummarySchema) });
export type FormTypesResponse = z.infer<typeof FormTypesResponseSchema>;

/** Gửi lên khi tạo (POST /form-types) hoặc lưu (PUT /form-types/:formTypeId) một loại đơn.
    Ngoài đúng dạng, máy chủ còn kiểm tra như trình soạn bằng validateFormTypeDraft (validators/form-types.ts). */
export const SaveFormTypeRequestSchema = z.object({
  name: z.string().trim().min(1),
  prefix: z.string(),
  /** Mô tả ngắn; null = không có */
  description: z.string().trim().nullable(),
  status: z.enum(FORM_TYPE_STATUSES),
  sections: z.array(FormSectionSchema).min(1),
});
export type SaveFormTypeRequest = z.infer<typeof SaveFormTypeRequestSchema>;

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
  /** PUT / DELETE /form-types/:formTypeId khi loại đơn không còn (vd người khác vừa xóa) (404) */
  notFound: 'Loại đơn này không còn. Có thể ai đó vừa xóa.',
  /** POST / PUT khi body sai định dạng (422). Bản soạn chưa hợp lệ thì báo bằng FORM_TYPE_DRAFT_MESSAGES */
  invalidRequest: 'Dữ liệu loại đơn không hợp lệ.',
  /** PUT khi đổi mã đơn của loại đơn đã có đơn (409) */
  prefixLocked: 'Loại đơn này đã có đơn nên không đổi được mã đơn.',
  /** PUT khi chuyển loại đơn đã phát hành (Đang mở / Đã đóng) về Nháp (409), xem canChooseDraftStatus */
  draftLocked: 'Loại đơn đã phát hành nên không về Nháp được. Muốn ngừng nhận đơn, hãy chuyển sang Đã đóng.',
  /** DELETE khi loại đơn đã có đơn (409) */
  hasForms: 'Loại đơn này đã có đơn nên không xóa được. Muốn ngừng nhận đơn, hãy chuyển sang Đã đóng.',
  /** Lưu xong, vd "Đã lưu loại đơn Xét miễn môn (Đang mở)." */
  saved: (name: string, statusLabel: string) => `Đã lưu loại đơn ${name} (${statusLabel}).`,
  /** Xóa xong */
  deleted: (name: string) => `Đã xóa loại đơn ${name}.`,
  /** Bấm Bỏ thay đổi */
  discarded: 'Đã bỏ các thay đổi chưa lưu.',
} as const;
