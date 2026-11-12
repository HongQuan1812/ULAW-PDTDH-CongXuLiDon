/* HỢP ĐỒNG nhóm API Cấu hình email (chỉ vai trò có quyền manageEmail): đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   Trang này chỉ cấu hình phía GỬI: người gửi, bật / tắt và nội dung thư của bốn lúc gửi.
   Người nhận không cấu hình: thư luôn gửi tới email của người nộp đơn (email trên trang Thông tin cá nhân).
   Người nộp đơn bấm "Trả lời" thì thư về chính địa chỉ gửi. Mã chèn vào thư: xem business-rules/email--tags.ts.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import { EMAIL_EVENT_STATUSES } from '../aux-schema/email--events';
import { VALIDATION_MESSAGES } from '../validators';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const EMAIL_ENDPOINTS = {
  /** GET → EmailSettingsResponse: cấu hình đang dùng.
      PUT EmailSettings → EmailSettingsResponse: lưu cả cấu hình (người gửi và bốn lúc gửi) trong một lần */
  settings: '/email-settings',
  /** POST SendTestEmailRequest → SendTestEmailResponse: gửi một thư thử theo bản đang soạn (chưa cần lưu), dùng dữ liệu mẫu */
  test: '/email-settings/test',
} as const;

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Người gửi: tên hiện ở dòng "Từ", địa chỉ gửi, chữ kí cuối thư (mã {chu_ki}). */
export const EmailSenderSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên người gửi.'),
  /** phải là địa chỉ máy chủ thư cho phép gửi */
  address: z.string().trim().toLowerCase().pipe(z.email(VALIDATION_MESSAGES.email)),
  /** để trống thì {chu_ki} thành chữ trống */
  signature: z.string().trim(),
});
export type EmailSender = z.infer<typeof EmailSenderSchema>;

/** Thư của một lúc gửi. Đang tắt thì không gửi, nhưng tiêu đề và nội dung vẫn giữ để bật lại. */
export const EmailEventSettingSchema = z.object({
  status: z.enum(EMAIL_EVENT_STATUSES),
  enabled: z.boolean(),
  subject: z.string().trim().min(1, 'Nhập tiêu đề thư.'),
  body: z.string().refine((body) => body.trim() !== '', 'Nhập nội dung thư.'),
});
export type EmailEventSetting = z.infer<typeof EmailEventSettingSchema>;

/** Cả cấu hình. Body của PUT /email-settings. Có đủ bốn lúc gửi, mỗi lúc đúng một lần, theo thứ tự EMAIL_EVENT_STATUSES. */
export const EmailSettingsSchema = z.object({
  sender: EmailSenderSchema,
  events: z
    .array(EmailEventSettingSchema)
    .refine(
      (events) =>
        events.length === EMAIL_EVENT_STATUSES.length && events.every((event, index) => event.status === EMAIL_EVENT_STATUSES[index]),
      'Cần đủ bốn lúc gửi email: Đã nộp, Cần bổ sung, Từ chối, Đã duyệt.',
    ),
});
export type EmailSettings = z.infer<typeof EmailSettingsSchema>;

/** Trả về từ GET, PUT /email-settings: cấu hình, kèm máy chủ thư đã kết nối được chưa (chưa thì không gửi được thư nào). */
export const EmailSettingsResponseSchema = z.object({
  settings: EmailSettingsSchema,
  mailServerConnected: z.boolean(),
});
export type EmailSettingsResponse = z.infer<typeof EmailSettingsResponseSchema>;

/** Body của POST /email-settings/test: thư đang soạn (chưa cần lưu) và địa chỉ nhận thử. */
export const SendTestEmailRequestSchema = z.object({
  to: z.string().trim().toLowerCase().pipe(z.email('Địa chỉ nhận thử chưa đúng.')),
  sender: EmailSenderSchema,
  subject: EmailEventSettingSchema.shape.subject,
  body: EmailEventSettingSchema.shape.body,
});
export type SendTestEmailRequest = z.infer<typeof SendTestEmailRequestSchema>;

/** Trả về từ POST /email-settings/test. */
export const SendTestEmailResponseSchema = z.object({ message: z.string() });
export type SendTestEmailResponse = z.infer<typeof SendTestEmailResponseSchema>;

/* ---------- Câu thông báo (lỗi hay thành công đều ghi ở đây) ---------- */

export const EMAIL_MESSAGES = {
  /** PUT /email-settings thành công */
  saved: 'Đã lưu cấu hình email',
  /** POST /email-settings/test thành công */
  testSent: (to: string) => `Đã gửi email thử tới ${to}`,
  401: 'Bạn chưa đăng nhập.',
  /** Mọi API của nhóm khi không có quyền manageEmail */
  403: 'Bạn không có quyền cấu hình email.',
  /** Body sai định dạng (422) */
  422: 'Cấu hình email chưa hợp lệ.',
  /** POST /email-settings/test khi chưa kết nối được máy chủ thư (503) */
  mailServerDown: 'Chưa kết nối được máy chủ thư, chưa gửi được email.',
} as const;
