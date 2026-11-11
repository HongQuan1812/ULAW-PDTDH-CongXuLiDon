/* Hộp thoại "Tạo tài khoản mới" / "Sửa thông tin tài khoản" ở trang Quản lí tài khoản (như openAccount() của artifact/js/accounts-page.js).
   Tạo: họ tên, email trường, vai trò bắt buộc; CCCD, SĐT không bắt buộc (người dùng tự điền khi đăng nhập lần đầu).
   Sửa: email không đổi được; vai trò của chính mình bị khóa. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  ACCOUNT_MESSAGES,
  CreateAccountRequestSchema,
  ROLES,
  ROLE_IDS,
  SCHOOL_EMAIL_DOMAINS,
  UpdateAccountRequestSchema,
  canChangeAccountRole,
  type Account,
  type CreateAccountRequest,
} from '@ulaw/shared';
import { useCreateAccount, useUpdateAccount } from '../../api/accounts';
import { ApiError } from '../../api/client';
import { usePersonFullCccd } from '../../api/profile';
import { Button } from '../../components/Button';
import { Field, RequiredMark } from '../../components/Field';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../features/auth/useAuth';
import dialogStyles from '../profile/EditProfileDialog.module.css';
import styles from './AccountDialog.module.css';

/* Sửa tài khoản: kiểm tra như máy chủ (UpdateAccountRequestSchema); ô email chỉ để xem nên nhận mọi chuỗi. */
const EDIT_FORM_SCHEMA = UpdateAccountRequestSchema.extend({ email: z.string() });

interface AccountDialogProps {
  open: boolean;
  /** Tài khoản cần sửa; null = tạo tài khoản mới */
  account: Account | null;
  /** Gọi khi đóng (bấm Đóng, Esc, nền mờ, hoặc lưu xong) */
  onClose: () => void;
  /** Gọi sau khi tạo xong, kèm tài khoản vừa tạo (để bảng hiện tài khoản đó) */
  onCreated: (account: Account) => void;
}

/**
 * Hộp thoại tạo / sửa tài khoản. Sửa tài khoản có CCCD thì tải số đầy đủ trước để điền sẵn (bảng chỉ có số đã che).
 * @param props  xem AccountDialogProps
 * @returns      hộp thoại
 */
export function AccountDialog({ open, account, onClose, onCreated }: AccountDialogProps) {
  const hasCccd = account?.maskedCccd != null;
  const fullCccdQuery = usePersonFullCccd(account?.id ?? '', open && hasCccd);
  const fullCccdError = loadErrorMessage(fullCccdQuery);

  // Chờ số CCCD đầy đủ (nếu có CCCD) rồi mới vẽ form, để ô CCCD có sẵn giá trị đúng
  const cccdReady = !hasCccd || fullCccdQuery.isSuccess;

  return (
    <Modal open={open} onClose={onClose} title={account ? 'Sửa thông tin tài khoản' : 'Tạo tài khoản mới'}>
      {cccdReady ? (
        <AccountForm
          key={account?.id ?? 'new'}
          account={account}
          fullCccd={hasCccd ? (fullCccdQuery.data?.cccd ?? '') : ''}
          onClose={onClose}
          onCreated={onCreated}
        />
      ) : fullCccdError ? (
        <>
          <LoadError message={`${fullCccdError} Đóng hộp này rồi mở lại để tải lại.`} />
          <div className={dialogStyles.actions}>
            <Button onClick={onClose}>Đóng</Button>
          </div>
        </>
      ) : (
        <p className={dialogStyles.muted}>Đang tải…</p>
      )}
    </Modal>
  );
}

/**
 * Form tạo / sửa tài khoản.
 * @param account    tài khoản cần sửa; null = tạo mới
 * @param fullCccd   số CCCD đầy đủ hiện tại; "" nếu chưa có hoặc tạo mới
 * @param onClose    gọi khi bấm Đóng hoặc lưu xong
 * @param onCreated  gọi sau khi tạo xong
 * @returns          form
 */
function AccountForm({
  account,
  fullCccd,
  onClose,
  onCreated,
}: {
  account: Account | null;
  fullCccd: string;
  onClose: () => void;
  onCreated: (account: Account) => void;
}) {
  const { user, role } = useAuth();
  const toast = useToast();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const isSaving = createAccount.isPending || updateAccount.isPending;
  // Không tự đổi vai trò của mình (tránh tự khóa mình khỏi trang này)
  const roleLocked = account !== null && !canChangeAccountRole({ id: user.id, role }, account.id);

  // Tạo mới kiểm tra cả email; sửa thì email chỉ để xem (không gửi lên)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<CreateAccountRequest>({
    resolver: zodResolver(account ? EDIT_FORM_SCHEMA : CreateAccountRequestSchema),
    defaultValues: {
      name: account?.name ?? '',
      email: account?.email ?? '',
      role: account?.role ?? 'nguoiNopDon',
      cccd: fullCccd,
      phone: account?.phone ?? '',
    },
  });

  // Form hiện ra (có thể sau lúc chờ tải số CCCD) thì đưa con trỏ vào ô Họ và tên
  useEffect(() => setFocus('name'), [setFocus]);

  // Ô CCCD và SĐT chỉ nhận chữ số: bỏ ký tự khác ngay khi gõ hoặc dán
  const digitsOnly = (event: { target: { value: string } }) => {
    event.target.value = event.target.value.replace(/\D/g, '');
  };

  // Gửi lên máy chủ; thành công thì báo, đóng hộp thoại (bảng tự tải lại)
  const onSubmit = handleSubmit(async (accountInput) => {
    try {
      if (account) {
        const { email: _email, ...changes } = accountInput;
        const saved = await updateAccount.mutateAsync({ userId: account.id, accountInput: changes });
        toast(ACCOUNT_MESSAGES.saved(saved.name), 'success');
      } else {
        const created = await createAccount.mutateAsync(accountInput);
        toast(ACCOUNT_MESSAGES.created(created.name, ROLES[created.role].name), 'success');
        onCreated(created);
      }
      onClose();
    } catch (error) {
      // Email / CCCD đã có tài khoản: báo ngay dưới ô đó; lỗi khác: báo chung phía trên nút
      const message = error instanceof Error ? error.message : ACCOUNT_MESSAGES[422];
      const field = message === ACCOUNT_MESSAGES.emailTaken ? 'email' : message === ACCOUNT_MESSAGES.cccdTaken ? 'cccd' : null;
      if (error instanceof ApiError && error.status === 409 && field) {
        setError(field, { message });
        setFocus(field);
        return;
      }
      setError('root', { message });
    }
  });

  /** Bỏ thay đổi: các ô về như lúc mở hộp (bỏ cả câu báo lỗi), con trỏ về ô Họ và tên. */
  const discardChanges = () => {
    reset();
    setFocus('name');
  };

  return (
    <form className={dialogStyles.form} onSubmit={onSubmit} noValidate>
      {!account && (
        <p className={dialogStyles.muted}>
          Người dùng đăng nhập bằng tài khoản Google của trường với email này. CCCD và số điện thoại có thể để trống, người dùng
          tự điền khi đăng nhập lần đầu.
        </p>
      )}

      <div className={dialogStyles.grid2}>
        <Field label="Họ và tên" required error={errors.name?.message}>
          <input autoComplete="off" aria-required="true" aria-invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field
          label="Email"
          required
          hint={account ? 'Dùng để đăng nhập, không đổi được' : 'Dùng để đăng nhập, không đổi được sau khi tạo'}
          error={errors.email?.message}
        >
          <input
            type="email"
            autoComplete="off"
            placeholder={`VD: ten@${SCHOOL_EMAIL_DOMAINS[0]}`}
            readOnly={!!account}
            aria-required="true"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        <Field label="Số CCCD" error={errors.cccd?.message}>
          <input
            inputMode="numeric"
            maxLength={12}
            autoComplete="off"
            placeholder="VD: 079206001234"
            aria-invalid={!!errors.cccd}
            {...register('cccd', { onChange: digitsOnly })}
          />
        </Field>
        <Field label="Số điện thoại" error={errors.phone?.message}>
          <input
            inputMode="tel"
            maxLength={10}
            autoComplete="off"
            placeholder="VD: 0901234567"
            aria-invalid={!!errors.phone}
            {...register('phone', { onChange: digitsOnly })}
          />
        </Field>
      </div>

      {/* Vai trò: chọn một; vai trò của chính mình bị khóa */}
      <fieldset className={styles.rolePick} disabled={roleLocked}>
        <legend>
          Vai trò
          <RequiredMark />
        </legend>
        {ROLE_IDS.map((roleId) => (
          <label key={roleId}>
            <input type="radio" value={roleId} {...register('role')} />
            <span>{ROLES[roleId].name}</span>
          </label>
        ))}
        {roleLocked && <p className={styles.roleHint}>Bạn không thể tự đổi vai trò của chính mình.</p>}
      </fieldset>

      {errors.root?.message && (
        <p className={dialogStyles.formError} role="alert">
          {errors.root.message}
        </p>
      )}

      {/* Góc dưới bên phải: chưa nhập / chưa sửa thì nút Đóng; đã nhập thì thay bằng Bỏ thay đổi · Tạo tài khoản / Lưu thay đổi */}
      <div className={dialogStyles.actions}>
        {isDirty ? (
          <>
            <Button variant="ghost" onClick={discardChanges} disabled={isSaving}>
              Bỏ thay đổi
            </Button>
            <Button variant="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Đang lưu…' : account ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Đóng</Button>
        )}
      </div>
    </form>
  );
}
