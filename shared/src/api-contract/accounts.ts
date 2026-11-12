/* HỢP ĐỒNG nhóm API Quản lí tài khoản (chỉ vai trò có quyền manageAccounts): đường dẫn, dữ liệu gửi / nhận, câu thông báo.
   API giả (MSW), frontend và backend cùng theo file này. */
import { z } from 'zod';
import { ROLE_IDS } from '../aux-schema/accounts--roles';
import type { ListSortRule } from '../aux-schema/lists';
import { ROLES } from '../business-rules/accounts--permissions';
import { formatPhone } from '../business-rules/lists--display-text';
import type { TableField } from '../business-rules/lists--query';
import { CCCD_PATTERN, PHONE_PATTERN, VALIDATION_MESSAGES, isFullName, isSchoolEmail } from '../validators';
import { ListPageMetaSchema } from './common';

/* ---------- Đường dẫn (phần sau /api) ---------- */

export const ACCOUNT_ENDPOINTS = {
  /** GET ?<một trang> (xem listQueryParams() ở common.ts) → AccountsResponse: một trang trong mọi tài khoản
      (người nộp đơn và cán bộ), cột theo ACCOUNT_LIST_FIELDS, CCCD đã che nhưng tìm được theo số CCCD đầy đủ.
      POST CreateAccountRequest → Account (201): tạo tài khoản mới */
  list: '/accounts',
  /** GET ?userIds=… → AccountCccdsResponse: CCCD đầy đủ của các tài khoản đang có trên trang bảng (chỉ gọi khi bấm "Hiện CCCD").
      Đặt trước /accounts/:userId để 'cccds' không bị hiểu là id */
  cccds: '/accounts/cccds',
  /** PUT UpdateAccountRequest → Account: sửa họ tên, CCCD, SĐT, vai trò của một tài khoản. Email không đổi được.
      Ngoại lệ của nhóm: quyền editApplicant (nút "Sửa thông tin" ở trang thông tin người khác) cũng sửa được,
      nhưng đổi vai trò vẫn cần manageAccounts */
  account: '/accounts/:userId',
} as const;

/**
 * Đường dẫn API của một tài khoản.
 * @param userId  id tài khoản
 * @returns       vd '/accounts/sv-2'
 */
export function accountPath(userId: string): string {
  return ACCOUNT_ENDPOINTS.account.replace(':userId', encodeURIComponent(userId));
}

/* ---------- Dữ liệu gửi / nhận ---------- */

/** Một tài khoản trong bảng Quản lí tài khoản. CCCD là dữ liệu nhạy cảm nên chỉ trả dạng che. */
export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ROLE_IDS),
  /** null = chưa có */
  phone: z.string().nullable(),
  /** vd "079•••••1234"; null = chưa có CCCD */
  maskedCccd: z.string().nullable(),
});
export type Account = z.infer<typeof AccountSchema>;

/** Trả về từ GET /accounts: một trang tài khoản, kèm tổng số tài khoản khớp và lựa chọn lọc. */
export const AccountsResponseSchema = ListPageMetaSchema.extend({ accounts: z.array(AccountSchema) });
export type AccountsResponse = z.infer<typeof AccountsResponseSchema>;

/** Trả về từ GET /accounts/cccds: CCCD đầy đủ theo id tài khoản đã hỏi (tài khoản chưa có CCCD thì không có mặt). */
export const AccountCccdsResponseSchema = z.object({ cccds: z.record(z.string(), z.string()) });
export type AccountCccdsResponse = z.infer<typeof AccountCccdsResponseSchema>;

/** Các cột của bảng Quản lí tài khoản. */
export const ACCOUNT_LIST_FIELDS: TableField<Account>[] = [
  { key: 'name', label: 'Họ và tên', type: 'text', getValue: (account) => account.name },
  { key: 'email', label: 'Email', type: 'text', getValue: (account) => account.email },
  {
    key: 'role',
    label: 'Vai trò',
    type: 'select',
    getValue: (account) => account.role,
    getLabel: (account) => ROLES[account.role].name,
    options: ROLE_IDS.map((roleId) => ({ value: roleId, label: ROLES[roleId].name })),
    getOrder: (account) => ROLE_IDS.indexOf(account.role),
  },
  { key: 'phone', label: 'Số điện thoại', type: 'text', getValue: (account) => (account.phone ? formatPhone(account.phone) : null) },
  { key: 'cccd', label: 'Số CCCD', type: 'text', getValue: (account) => account.maskedCccd },
];

/** Thứ tự bảng tài khoản khi chưa chọn sắp xếp: họ tên A → Z. */
export const ACCOUNT_LIST_DEFAULT_SORTING: ListSortRule[] = [{ id: 'name', desc: false }];

/* Các ô dùng chung cho tạo và sửa: họ tên bắt buộc; CCCD và SĐT không bắt buộc (gửi "" nếu không có),
   có nhập thì phải đúng định dạng. Các ô được cắt khoảng trắng đầu và cuối. */
const accountFields = {
  name: z.string().trim().refine(isFullName, VALIDATION_MESSAGES.fullName),
  cccd: z.string().trim().refine((cccdText) => cccdText === '' || CCCD_PATTERN.test(cccdText), VALIDATION_MESSAGES.cccd),
  phone: z.string().trim().refine((phoneText) => phoneText === '' || PHONE_PATTERN.test(phoneText), VALIDATION_MESSAGES.phone),
  role: z.enum(ROLE_IDS),
};

/**
 * Body của POST /accounts. Họ tên, email, vai trò bắt buộc; email phải là email trường, được đổi về chữ thường.
 * CCCD, SĐT để trống thì người dùng tự điền ở bước bổ sung thông tin khi đăng nhập lần đầu.
 */
export const CreateAccountRequestSchema = z.object({
  ...accountFields,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email(VALIDATION_MESSAGES.email))
    .refine(isSchoolEmail, VALIDATION_MESSAGES.schoolEmail),
});
export type CreateAccountRequest = z.infer<typeof CreateAccountRequestSchema>;

/** Body của PUT /accounts/:userId. Không có email: email không đổi được sau khi tạo. */
export const UpdateAccountRequestSchema = z.object(accountFields);
export type UpdateAccountRequest = z.infer<typeof UpdateAccountRequestSchema>;

/* ---------- Câu thông báo (lỗi hay thành công đều ghi ở đây) ---------- */

export const ACCOUNT_MESSAGES = {
  /** POST /accounts thành công */
  created: (name: string, roleName: string) => `Đã tạo tài khoản ${name} (${roleName})`,
  /** PUT /accounts/:userId thành công */
  saved: (name: string) => `Đã lưu thay đổi tài khoản ${name}`,
  401: 'Bạn chưa đăng nhập.',
  /** Mọi API của nhóm khi không có quyền manageAccounts (PUT: không có cả editApplicant) */
  403: 'Bạn không có quyền quản lí tài khoản.',
  /** PUT /accounts/:userId: có editApplicant nhưng không có manageAccounts mà đổi vai trò (403) */
  roleForbidden: 'Bạn không có quyền đổi vai trò tài khoản.',
  /** PUT /accounts/:userId khi không có tài khoản này */
  404: 'Không có tài khoản này.',
  /** POST /accounts: email đã có tài khoản (409) */
  emailTaken: 'Email này đã có tài khoản.',
  /** POST, PUT: CCCD đã thuộc tài khoản khác (409) */
  cccdTaken: 'Số CCCD này đã thuộc tài khoản khác.',
  /** PUT /accounts/:userId: Admin đổi vai trò của chính mình (422), để không tự khóa mình khỏi trang này */
  ownRole: 'Bạn không tự đổi được vai trò của mình.',
  /** Body sai định dạng (422) */
  422: 'Thông tin tài khoản chưa hợp lệ.',
} as const;
