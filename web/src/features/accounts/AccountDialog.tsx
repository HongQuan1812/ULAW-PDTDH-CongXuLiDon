/* Hộp thoại "Tạo tài khoản mới" / "Sửa thông tin tài khoản", dùng chung một hộp ở mọi nơi (như openAccount() của artifact/js/accounts-page.js):
   - nút "Sửa thông tin" ở trang Thông tin cá nhân (tài khoản của mình)
   - nút "+ Tạo tài khoản" và nút Sửa ở trang Quản lí tài khoản
   - nút "Sửa thông tin" ở trang thông tin người khác (quyền editApplicant)
   Hộp thay đổi theo VAI TRÒ người đang dùng, không theo trang: có quyền manageAccounts (Admin) thì có phần Vai trò
   (vai trò của chính mình bị khóa); vai trò khác không thấy phần Vai trò.
   Tạo: họ tên, email trường, vai trò bắt buộc; CCCD, SĐT không bắt buộc (người dùng tự điền khi đăng nhập lần đầu).
   Sửa: email không đổi được. Sửa tài khoản của mình lưu qua PUT /profile/me (vai trò nào cũng dùng được), tài khoản khác qua PUT /accounts/:userId. */
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
  can,
  canChangeAccountRole,
  type Account,
  type CreateAccountRequest,
} from '@ulaw/shared';
import { useCreateAccount, useUpdateAccount } from '../../api/accounts';
import { ApiError } from '../../api/client';
import { useMyFullCccd, usePersonFullCccd, useUpdateProfile } from '../../api/profile';
import { Button } from '../../components/Button';
import { Field, RequiredMark } from '../../components/Field';
import { LoadError, loadErrorMessage } from '../../components/LoadError';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useAuth } from '../auth/useAuth';
import styles from './AccountDialog.module.css';

/** Câu báo khi sửa xong tài khoản của mình, như bản mẫu ("Đã cập nhật thông tin" khi sửa từ trang thông tin). */
const MY_PROFILE_UPDATED_TEXT = 'Đã cập nhật thông tin';

/* Sửa tài khoản: kiểm tra như máy chủ (UpdateAccountRequestSchema); ô email chỉ để xem nên nhận mọi chuỗi. */
const EDIT_FORM_SCHEMA = UpdateAccountRequestSchema.extend({ email: z.string() });

interface AccountDialogProps {
  open: boolean;
  /** Tài khoản cần sửa; null = tạo tài khoản mới */
  account: Account | null;
  /** Gọi khi đóng (bấm Đóng, Esc, nền mờ, hoặc lưu xong) */
  onClose: () => void;
  /** Gọi sau khi tạo xong, kèm tài khoản vừa tạo (để bảng hiện tài khoản đó). Chỉ cần khi có thể tạo mới */
  onCreated?: (account: Account) => void;
}

/**
 * Hộp thoại tạo / sửa tài khoản. Sửa tài khoản có CCCD thì tải số đầy đủ trước để điền sẵn (nơi mở hộp chỉ có số đã che).
 * @param props  xem AccountDialogProps
 * @returns      hộp thoại
 */
export function AccountDialog({ open, account, onClose, onCreated }: AccountDialogProps) {
  const { user } = useAuth();
  const isMine = account?.id === user.id;
  const hasCccd = account?.maskedCccd != null;

  // Số CCCD đầy đủ: của mình qua /profile/me/cccd (ai cũng xem được số của mình), của người khác qua /profile/:userId/cccd
  const myCccdQuery = useMyFullCccd(open && hasCccd && isMine);
  const personCccdQuery = usePersonFullCccd(account?.id ?? '', open && hasCccd && !isMine);
  const fullCccdQuery = isMine ? myCccdQuery : personCccdQuery;
  const fullCccdError = loadErrorMessage(fullCccdQuery);

  // Chờ số CCCD đầy đủ (nếu có CCCD) rồi mới vẽ form, để ô CCCD có sẵn giá trị đúng
  const cccdReady = !hasCccd || fullCccdQuery.isSuccess;

  return (
    <Modal open={open} onClose={onClose} title={account ? 'Sửa thông tin tài khoản' : 'Tạo tài khoản mới'}>
      {cccdReady ? (
        <AccountForm
          key={account?.id ?? 'new'}
          account={account}
          isMine={isMine}
          fullCccd={hasCccd ? (fullCccdQuery.data?.cccd ?? '') : ''}
          onClose={onClose}
          onCreated={onCreated}
        />
      ) : fullCccdError ? (
        <>
          <LoadError message={`${fullCccdError} Đóng hộp này rồi mở lại để tải lại.`} />
          <div className={styles.actions}>
            <Button onClick={onClose}>Đóng</Button>
          </div>
        </>
      ) : (
        <p className={styles.muted}>Đang tải…</p>
      )}
    </Modal>
  );
}

/**
 * Form tạo / sửa tài khoản: Họ và tên · Email · Số CCCD, Số điện thoại · Vai trò (chỉ Admin).
 * @param account    tài khoản cần sửa; null = tạo mới
 * @param isMine     tài khoản đang sửa là của người đang đăng nhập
 * @param fullCccd   số CCCD đầy đủ hiện tại; "" nếu chưa có hoặc tạo mới
 * @param onClose    gọi khi bấm Đóng hoặc lưu xong
 * @param onCreated  gọi sau khi tạo xong (không bắt buộc)
 * @returns          form
 */
function AccountForm({
  account,
  isMine,
  fullCccd,
  onClose,
  onCreated,
}: {
  account: Account | null;
  isMine: boolean;
  fullCccd: string;
  onClose: () => void;
  onCreated?: (account: Account) => void;
}) {
  const { user, role } = useAuth();
  const toast = useToast();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const updateProfile = useUpdateProfile();
  const isSaving = createAccount.isPending || updateAccount.isPending || updateProfile.isPending;

  // Phần Vai trò: chỉ người có quyền quản lí tài khoản thấy; vai trò của chính mình bị khóa (tránh tự khóa mình khỏi trang này)
  const showRole = can(role, 'manageAccounts');
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

  // Gửi lên máy chủ; thành công thì báo, đóng hộp thoại (các trang liên quan tự tải lại)
  const onSubmit = handleSubmit(async (accountInput) => {
    const { email: _email, ...changes } = accountInput;
    try {
      if (account && isMine) {
        // Tài khoản của mình: họ tên, CCCD, SĐT (vai trò không đổi)
        await updateProfile.mutateAsync({ name: changes.name, cccd: changes.cccd, phone: changes.phone });
        toast(MY_PROFILE_UPDATED_TEXT, 'success');
      } else if (account) {
        const saved = await updateAccount.mutateAsync({ userId: account.id, accountInput: changes });
        toast(ACCOUNT_MESSAGES.saved(saved.name), 'success');
      } else {
        const created = await createAccount.mutateAsync(accountInput);
        toast(ACCOUNT_MESSAGES.created(created.name, ROLES[created.role].name), 'success');
        onCreated?.(created);
      }
      onClose();
    } catch (error) {
      // Email / CCCD đã có tài khoản (409): báo ngay dưới ô đó; lỗi khác: báo chung phía trên nút
      const message = error instanceof Error ? error.message : ACCOUNT_MESSAGES[422];
      if (error instanceof ApiError && error.status === 409) {
        const field = message === ACCOUNT_MESSAGES.emailTaken ? 'email' : 'cccd';
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
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {!account && (
        <p className={styles.muted}>
          Người dùng đăng nhập bằng tài khoản Google của trường với email này. CCCD và số điện thoại có thể để trống, người dùng
          tự điền khi đăng nhập lần đầu.
        </p>
      )}

      <Field label="Họ và tên" required hint="Ghi đầy đủ, có dấu, đúng như trên CCCD" error={errors.name?.message}>
        <input autoComplete={isMine ? 'name' : 'off'} aria-required="true" aria-invalid={!!errors.name} {...register('name')} />
      </Field>

      <Field
        label="Email"
        required
        hint={account ? 'Lấy từ tài khoản Google, không sửa được' : 'Dùng để đăng nhập, không đổi được sau khi tạo'}
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

      <div className={styles.grid2}>
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
            autoComplete={isMine ? 'tel' : 'off'}
            placeholder="VD: 0901234567"
            aria-invalid={!!errors.phone}
            {...register('phone', { onChange: digitsOnly })}
          />
        </Field>
      </div>

      {/* Vai trò (chỉ Admin): chọn một; vai trò của chính mình bị khóa */}
      {showRole && (
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
      )}

      {errors.root?.message && (
        <p className={styles.formError} role="alert">
          {errors.root.message}
        </p>
      )}

      {/* Góc dưới bên phải: chưa nhập / chưa sửa thì nút Đóng; đã nhập thì thay bằng Bỏ thay đổi · Tạo tài khoản / Lưu thay đổi */}
      <div className={styles.actions}>
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
