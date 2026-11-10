/* Hộp thoại "Sửa thông tin tài khoản" trên trang Thông tin cá nhân: sửa họ tên, CCCD, SĐT của mình.
   Email không sửa được. Dùng chung API PUT /profile/me với màn Bổ sung thông tin lần đầu. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { PROFILE_MESSAGES, UpdateProfileRequestSchema, type Profile, type UpdateProfileRequest } from '@ulaw/shared';
import { useMyFullCccd, useUpdateProfile } from '../../api/profile';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import styles from './EditProfileDialog.module.css';

/** Câu báo thành công, như bản mẫu ("Đã cập nhật thông tin" khi sửa từ trang thông tin). */
const UPDATED_TEXT = 'Đã cập nhật thông tin';

/**
 * Hộp thoại sửa thông tin. Có CCCD thì tải số đầy đủ trước để điền sẵn vào ô (hồ sơ chỉ có số đã che).
 * @param open     đang mở hay không
 * @param onClose  gọi khi đóng (bấm Hủy, Esc, nền mờ, hoặc lưu xong)
 * @param profile  hồ sơ hiện tại của mình
 * @returns        hộp thoại
 */
export function EditProfileDialog({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: Profile }) {
  const hasCccd = profile.maskedCccd !== null;
  const fullCccdQuery = useMyFullCccd(open && hasCccd);

  // Chờ số CCCD đầy đủ (nếu có CCCD) rồi mới vẽ form, để ô CCCD có sẵn giá trị đúng
  const cccdReady = !hasCccd || fullCccdQuery.isSuccess;

  return (
    <Modal open={open} onClose={onClose} title="Sửa thông tin tài khoản">
      {cccdReady ? (
        <EditProfileForm
          profile={profile}
          fullCccd={hasCccd ? (fullCccdQuery.data?.cccd ?? '') : ''}
          onClose={onClose}
        />
      ) : fullCccdQuery.isError ? (
        <>
          <p className={styles.formError} role="alert">
            {fullCccdQuery.error.message}
          </p>
          <div className={styles.actions}>
            <Button variant="ghost" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </>
      ) : (
        <p className={styles.muted}>Đang tải…</p>
      )}
    </Modal>
  );
}

/**
 * Form sửa họ tên, CCCD, SĐT. Họ tên bắt buộc; CCCD và SĐT có nhập thì phải đúng định dạng.
 * @param profile   hồ sơ hiện tại (lấy email, họ tên, SĐT)
 * @param fullCccd  số CCCD đầy đủ hiện tại; "" nếu chưa có
 * @param onClose   gọi khi bấm Hủy hoặc lưu xong
 * @returns         form
 */
function EditProfileForm({ profile, fullCccd, onClose }: { profile: Profile; fullCccd: string; onClose: () => void }) {
  const toast = useToast();
  const updateProfile = useUpdateProfile();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<UpdateProfileRequest>({
    resolver: zodResolver(UpdateProfileRequestSchema),
    defaultValues: { name: profile.name, cccd: fullCccd, phone: profile.phone ?? '' },
  });

  // Form hiện ra (có thể sau lúc chờ tải số CCCD) thì đưa con trỏ vào ô Họ và tên
  useEffect(() => setFocus('name'), [setFocus]);

  // Ô CCCD và SĐT chỉ nhận chữ số: bỏ ký tự khác ngay khi gõ hoặc dán
  const digitsOnly = (event: { target: { value: string } }) => {
    event.target.value = event.target.value.replace(/\D/g, '');
  };

  // Gửi lên máy chủ; thành công thì báo, đóng hộp thoại (hồ sơ và tên trên thanh menu tự cập nhật)
  const onSubmit = handleSubmit(async (profileInput) => {
    try {
      await updateProfile.mutateAsync(profileInput);
      toast(UPDATED_TEXT);
      onClose();
    } catch (error) {
      // CCCD trùng: báo ngay dưới ô CCCD; lỗi khác: báo chung phía trên nút
      if (error instanceof ApiError && error.status === 409) {
        setError('cccd', { message: error.message });
        setFocus('cccd');
        return;
      }
      setError('root', { message: error instanceof Error ? error.message : PROFILE_MESSAGES[422] });
    }
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <Field label="Họ và tên" required hint="Ghi đầy đủ, có dấu, đúng như trên CCCD" error={errors.name?.message}>
        <input autoComplete="name" aria-required="true" aria-invalid={!!errors.name} {...register('name')} />
      </Field>

      <Field label="Email" required hint="Lấy từ tài khoản Google, không sửa được">
        <input value={profile.email} readOnly aria-required="true" />
      </Field>

      <div className={styles.grid2}>
        <Field label="Số CCCD" optional error={errors.cccd?.message}>
          <input
            inputMode="numeric"
            maxLength={12}
            autoComplete="off"
            placeholder="VD: 079206001234"
            aria-invalid={!!errors.cccd}
            {...register('cccd', { onChange: digitsOnly })}
          />
        </Field>
        <Field label="Số điện thoại" optional error={errors.phone?.message}>
          <input
            inputMode="tel"
            maxLength={10}
            autoComplete="tel"
            placeholder="VD: 0901234567"
            aria-invalid={!!errors.phone}
            {...register('phone', { onChange: digitsOnly })}
          />
        </Field>
      </div>

      {errors.root?.message && (
        <p className={styles.formError} role="alert">
          {errors.root.message}
        </p>
      )}

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose} disabled={updateProfile.isPending}>
          Hủy
        </Button>
        <Button variant="primary" type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}
