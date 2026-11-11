/* HỢP ĐỒNG nhóm API loại đơn: đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này.
   Quy ước tên: form = lá đơn sinh viên nộp · form type = loại đơn (mẫu do cán bộ soạn).

   Mỗi loại đơn có nhiều phiên bản (1, 2, 3…). Mã đơn (tiền tố) dùng chung; tên, mô tả, các phần, câu hỏi thuộc từng phiên bản.
   - Nháp: phiên bản đang soạn, sửa được, xóa được. Mỗi loại đơn có nhiều nhất một phiên bản Nháp, luôn là phiên bản mới nhất.
   - Mở một phiên bản (Đang mở) thì nội dung phiên bản đó khóa cứng; phiên bản đang mở trước đó tự chuyển sang Đã đóng
     (mỗi lúc chỉ một phiên bản nhận đơn). Phiên bản đã khóa chỉ đổi qua lại Đang mở / Đã đóng.
   - Muốn sửa nội dung đã khóa thì tạo phiên bản mới. Mã đơn khóa từ khi phiên bản đầu tiên được mở. */
import { z } from 'zod';
import { FormSectionSchema } from '../aux-schema/form-types--sections';
import { FORM_TYPE_STATUSES } from '../aux-schema/form-types--statuses';
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
} as const;

/**
 * Đường dẫn API của một loại đơn (phiên bản đang mở).
 * @param formTypeId  mã loại đơn, vd 'xmm'
 * @returns           vd '/form-types/xmm'
 */
export function formTypeDetailPath(formTypeId: string): string {
  return FORM_TYPE_ENDPOINTS.detail.replace(':formTypeId', encodeURIComponent(formTypeId));
}

/**
 * Đường dẫn API các phiên bản của một loại đơn.
 * @param formTypeId  mã loại đơn
 * @returns           vd '/form-types/xmm/versions'
 */
export function formTypeVersionsPath(formTypeId: string): string {
  return FORM_TYPE_ENDPOINTS.versions.replace(':formTypeId', encodeURIComponent(formTypeId));
}

/**
 * Đường dẫn API một phiên bản.
 * @param formTypeId  mã loại đơn
 * @param version     số phiên bản
 * @returns           vd '/form-types/xmm/versions/2'
 */
export function formTypeVersionPath(formTypeId: string, version: number): string {
  return `${formTypeVersionsPath(formTypeId)}/${version}`;
}

/**
 * Đường dẫn API mở / đóng một phiên bản.
 * @param formTypeId  mã loại đơn
 * @param version     số phiên bản
 * @returns           vd '/form-types/xmm/versions/2/status'
 */
export function formTypeVersionStatusPath(formTypeId: string, version: number): string {
  return `${formTypeVersionPath(formTypeId, version)}/status`;
}

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Một loại đơn đang nhận đơn (theo phiên bản đang mở): đủ để người nộp chọn, chưa có cấu trúc các phần, câu hỏi. */
export const OpenFormTypeSchema = z.object({
  /** Mã loại đơn, vd 'xmm' */
  id: z.string(),
  /** Tên loại đơn, vd 'Xét miễn môn' */
  name: z.string(),
  /** Tiền tố mã đơn, vd 'XMM' (mã đơn XMM-2026-001-00001) */
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
  /** Nháp: lưu để soạn tiếp · Đang mở: mở phiên bản này (phiên bản đang mở khác tự đóng) */
  status: z.enum(DRAFT_SAVE_STATUSES),
  sections: z.array(FormSectionSchema).min(1),
});
export type SaveFormTypeVersionRequest = z.infer<typeof SaveFormTypeVersionRequestSchema>;

/** Gửi lên khi mở / đóng phiên bản đã khóa. Mở thì phiên bản đang mở khác tự đóng. */
export const SetFormTypeVersionStatusRequestSchema = z.object({ status: z.enum(LOCKED_VERSION_STATUSES) });
export type SetFormTypeVersionStatusRequest = z.infer<typeof SetFormTypeVersionStatusRequestSchema>;

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
  /** Lưu xong, vd "Đã lưu phiên bản 2 của Xét miễn môn (Nháp)." */
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
  /** Bấm Bỏ thay đổi */
  discarded: 'Đã bỏ các thay đổi chưa lưu.',
} as const;
