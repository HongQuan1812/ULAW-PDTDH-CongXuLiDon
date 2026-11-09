/* Màn Bổ sung thông tin lần đầu (màn hình 2 của bản mẫu): xác nhận họ tên, CCCD và SĐT không bắt buộc. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router';
import { PROFILE_MESSAGES, UpdateProfileRequestSchema, type Session, type UpdateProfileRequest } from '@ulaw/shared';
import { useLogout, useSession } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useUpdateProfile } from '../../api/profile';
import { LOGIN_PATH, homePath } from '../../app/paths';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { useToast } from '../../components/Toast';
import styles from './OnboardingPage.module.css';

/**
 * Chặn theo phiên: chưa đăng nhập thì về Đăng nhập; đã bổ sung thông tin rồi thì vào trang chính.
 * @returns  form bổ sung thông tin, hoặc chuyển trang
 */
export function OnboardingPage() {
  const session = useSession();

  // Đang kiểm tra phiên: chưa vẽ gì
  if (session.isPending) return null;

  if (!session.data) return <Navigate to={LOGIN_PATH} replace />;
  if (session.data.profileCompleted) return <Navigate to={homePath(session.data.role)} replace />;
  return <OnboardingForm session={session.data} />;
}

/**
 * Form bổ sung thông tin. Họ tên bắt buộc; CCCD và SĐT có nhập thì phải đúng định dạng.
 * @param session  phiên đăng nhập hiện tại (lấy email và họ tên gợi ý)
 * @returns        giao diện màn hình
 */
function OnboardingForm({ session }: { session: Session }) {
  const { user } = session;
  const toast = useToast();
  const logout = useLogout();
  const updateProfile = useUpdateProfile();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<UpdateProfileRequest>({
    resolver: zodResolver(UpdateProfileRequestSchema),
    defaultValues: { name: user.name, cccd: '', phone: '' },
  });

  // Ô CCCD và SĐT chỉ nhận chữ số: bỏ ký tự khác ngay khi gõ hoặc dán
  const digitsOnly = (event: { target: { value: string } }) => {
    event.target.value = event.target.value.replace(/\D/g, '');
  };

  // Gửi lên máy chủ; thành công thì phiên đổi sang "đã bổ sung" và trang tự chuyển vào ứng dụng
  const onSubmit = handleSubmit(async (profileInput) => {
    try {
      await updateProfile.mutateAsync(profileInput);
      toast(PROFILE_MESSAGES[200]);
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
    <div className={styles.screen}>
      <header className={styles.top}>
        <img src="/assets/logo.png" alt="" />
        <div>
          <p className={styles.school}>Trường Đại học Luật TP. Hồ Chí Minh</p>
          <p className={styles.appName}>Cổng xử lí đơn</p>
        </div>
      </header>

      <form className={styles.onb} onSubmit={onSubmit} noValidate>
        <ol className={styles.steps} aria-label="Các bước">
          <li className={styles.done}>Đăng nhập</li>
          <li className={styles.current} aria-current="step">
            Bổ sung thông tin
          </li>
          <li>Bắt đầu sử dụng</li>
        </ol>

        <section className={styles.card}>
          <h2>Bổ sung thông tin</h2>
          <p className={styles.muted}>
            Lần đầu đăng nhập, bạn cần xác nhận họ và tên. CCCD và số điện thoại có thể bổ sung sau ở trang Thông tin cá nhân.
          </p>

          <Field label="Email">
            <input value={user.email} readOnly />
          </Field>

          <Field label="Họ và tên" hint="Ghi đầy đủ, có dấu, đúng như trên CCCD" error={errors.name?.message}>
            <input autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
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
            <Button variant="ghost" disabled={logout.isPending} onClick={() => logout.mutate()}>
              Đăng xuất
            </Button>
            <Button variant="primary" type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Đang lưu…' : 'Lưu và tiếp tục'}
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}
