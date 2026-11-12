/* HỢP ĐỒNG nhóm API NHIỀU lá đơn: các bảng đơn (đơn mình đã nộp, đơn phụ trách, Quản lí đơn) và CCCD người nộp.
   Một lá đơn (nộp, chi tiết, sửa, xử lí) nằm ở form.ts.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import { FORM_STATUSES, FORM_STATUS_LABEL, FORM_TYPE_STATUSES, type ListSortRule } from '../aux-schema';
import type { TableField } from '../business-rules/lists--query';
import { ListPageMetaSchema } from './common';
import { FormSummarySchema, StaffRefSchema, type FormSummary } from './form';

/* ---------- Đường dẫn (phần sau /api) ---------- */

/* Các danh sách đơn phân trang ở máy chủ: gửi trang, tìm, sắp xếp, lọc theo listQueryParams() (xem common.ts),
   tên cột lấy theo các bảng cột bên dưới (FORM_LIST_FIELDS…). */
export const FORMS_ENDPOINTS = {
  /** GET ?<một trang> → ManagedFormsResponse: một trang trong mọi đơn của mọi người nộp (bảng ở trang Quản lí đơn),
      cột theo MANAGED_FORM_LIST_FIELDS. Cần quyền viewAll.
      CCCD người nộp trả dạng che; người có quyền viewApplicant tìm được theo số CCCD đầy đủ. Muốn xem đủ thì gọi cccds */
  list: '/forms',
  /** GET ?userIds=… → FormCccdsResponse: CCCD đầy đủ của những người nộp đang có trên trang bảng (nút "Hiện CCCD" ở trang Quản lí đơn).
      Cần quyền viewApplicant */
  cccds: '/forms/cccds',
  /** GET: số đơn theo trạng thái và theo loại đơn → FormStats (hai khung thống kê đầu trang Quản lí đơn). Cần quyền viewAll */
  stats: '/forms/stats',
  /** GET ?<một trang> → MyFormsResponse: một trang trong các đơn mình đã nộp (bảng "Đơn đã nộp" trên trang Thông tin cá nhân),
      cột theo FORM_LIST_FIELDS */
  mine: '/forms/mine',
  /** GET ?<một trang> → HandledFormsResponse: một trang trong các đơn mình là người tiếp nhận hoặc người xử lí (mục "Đơn phụ trách"),
      cột theo HANDLED_FORM_LIST_FIELDS. Cần quyền decide */
  handled: '/forms/handled',
} as const;

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Trả về từ GET /forms/mine (và GET /profile/:userId/forms): một trang đơn, kèm tổng số đơn khớp và lựa chọn lọc. */
export const MyFormsResponseSchema = ListPageMetaSchema.extend({ forms: z.array(FormSummarySchema) });
export type MyFormsResponse = z.infer<typeof MyFormsResponseSchema>;

/** Một dòng trong bảng "Đơn phụ trách": thông tin chính của đơn, kèm người tiếp nhận và người xử lí. */
export const HandledFormSummarySchema = FormSummarySchema.extend({
  /** Cán bộ đã bấm "Tiếp nhận"; null = chưa tiếp nhận */
  receiver: StaffRefSchema.nullable(),
  /** Cán bộ đang xử lí (khác người tiếp nhận nếu đơn đã được chuyển giao); null = chưa tiếp nhận */
  handler: StaffRefSchema.nullable(),
});
export type HandledFormSummary = z.infer<typeof HandledFormSummarySchema>;

/** Trả về từ GET /forms/handled (và GET /profile/:userId/handled-forms): một trang đơn phụ trách, kèm tổng số và lựa chọn lọc. */
export const HandledFormsResponseSchema = ListPageMetaSchema.extend({ forms: z.array(HandledFormSummarySchema) });
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

/** Trả về từ GET /forms: một trang trong mọi đơn, kèm tổng số đơn khớp và lựa chọn lọc. */
export const ManagedFormsResponseSchema = ListPageMetaSchema.extend({ forms: z.array(ManagedFormSummarySchema) });
export type ManagedFormsResponse = z.infer<typeof ManagedFormsResponseSchema>;

/** Trả về từ GET /forms/cccds: CCCD đầy đủ theo id người nộp đã hỏi (người chưa có CCCD, hoặc chưa nộp đơn nào, thì không có mặt). */
export const FormCccdsResponseSchema = z.object({ cccds: z.record(z.string(), z.string()) });
export type FormCccdsResponse = z.infer<typeof FormCccdsResponseSchema>;

/** Số đơn của một loại đơn (kể cả loại chưa có đơn nào, đếm 0). */
export const FormTypeCountSchema = z.object({
  formTypeId: z.string(),
  formTypeName: z.string(),
  /** Nháp / Đang mở / Đã đóng, để biểu đồ ghi chú loại không còn nhận đơn */
  formTypeStatus: z.enum(FORM_TYPE_STATUSES),
  count: z.number().int().min(0),
});
export type FormTypeCount = z.infer<typeof FormTypeCountSchema>;

/** Trả về từ GET /forms/stats: đếm trên TẤT CẢ đơn, không theo ô tìm kiếm hay bộ lọc của bảng. */
export const FormStatsSchema = z.object({
  total: z.number().int().min(0),
  /** Đủ mọi trạng thái, trạng thái chưa có đơn thì 0 */
  byStatus: z.object(Object.fromEntries(FORM_STATUSES.map((status) => [status, z.number().int().min(0)])) as Record<(typeof FORM_STATUSES)[number], z.ZodNumber>),
  byType: z.array(FormTypeCountSchema),
});
export type FormStats = z.infer<typeof FormStatsSchema>;

/* ---------- Các cột của bảng đơn (tên cột để sắp xếp, lọc; cách hiện, cách tìm) ---------- */

/** Các cột thông tin đơn của mọi bảng đơn: Mã đơn, Loại đơn, Ngày nộp, Trạng thái. */
export const FORM_LIST_FIELDS: TableField<FormSummary>[] = [
  { key: 'code', label: 'Mã đơn', type: 'text', getValue: (form) => form.code },
  {
    key: 'formType',
    label: 'Loại đơn',
    type: 'select',
    getValue: (form) => form.formTypeId,
    getLabel: (form) => form.formTypeName,
  },
  { key: 'submittedAt', label: 'Ngày nộp', type: 'date', getValue: (form) => form.submittedAt },
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    getValue: (form) => form.status,
    getLabel: (form) => FORM_STATUS_LABEL[form.status],
    options: FORM_STATUSES.map((status) => ({ value: status, label: FORM_STATUS_LABEL[status] })),
  },
];

/** Bảng "Đơn phụ trách": thông tin đơn, rồi Người tiếp nhận, Người xử lí (lựa chọn lọc theo tên cán bộ có trong dữ liệu). */
export const HANDLED_FORM_LIST_FIELDS: TableField<HandledFormSummary>[] = [
  ...FORM_LIST_FIELDS,
  {
    key: 'receiver',
    label: 'Người tiếp nhận',
    type: 'select',
    getValue: (form) => form.receiver?.id ?? null,
    getLabel: (form) => form.receiver?.name ?? '',
  },
  {
    key: 'handler',
    label: 'Người xử lí',
    type: 'select',
    getValue: (form) => form.handler?.id ?? null,
    getLabel: (form) => form.handler?.name ?? '',
  },
];

/** Bảng Quản lí đơn: thông tin đơn, lúc tiếp nhận, rồi thông tin người nộp. */
export const MANAGED_FORM_LIST_FIELDS: TableField<ManagedFormSummary>[] = [
  ...FORM_LIST_FIELDS,
  { key: 'receivedAt', label: 'Thời gian tiếp nhận', type: 'datetime', getValue: (form) => form.receivedAt },
  { key: 'name', label: 'Họ và tên', type: 'text', getValue: (form) => form.applicant.name },
  { key: 'cccd', label: 'Số CCCD', type: 'text', getValue: (form) => form.applicant.maskedCccd },
  { key: 'phone', label: 'Số điện thoại', type: 'text', getValue: (form) => form.applicant.phone },
  { key: 'email', label: 'Email', type: 'text', getValue: (form) => form.applicant.email },
];

/** Thứ tự mọi bảng đơn khi chưa chọn sắp xếp: đơn mới nộp lên trên, cùng lúc thì mã đơn lớn lên trên. */
export const FORM_LIST_DEFAULT_SORTING: ListSortRule[] = [
  { id: 'submittedAt', desc: true },
  { id: 'code', desc: true },
];

/* ---------- Câu thông báo ---------- */

export const FORMS_MESSAGES = {
  /** Gọi API khi chưa đăng nhập */
  401: 'Bạn chưa đăng nhập.',
  /** GET /forms/handled khi vai trò không được xử lí đơn (không có quyền decide) */
  handledForbidden: 'Bạn không có quyền xem đơn phụ trách.',
  /** GET /forms khi vai trò không được xem mọi đơn (không có quyền viewAll) */
  listForbidden: 'Bạn không có quyền xem tất cả đơn.',
  /** GET /forms/stats khi vai trò không được xem mọi đơn (không có quyền viewAll) */
  statsForbidden: 'Bạn không có quyền xem thống kê đơn.',
  /** GET /forms/cccds khi vai trò không được xem hồ sơ người nộp đơn (không có quyền viewApplicant) */
  cccdsForbidden: 'Bạn không có quyền xem CCCD người nộp đơn.',
} as const;
