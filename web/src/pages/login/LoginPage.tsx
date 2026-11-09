/* Trang Đăng nhập (màn hình 1 của bản mẫu). */
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ROLES, ROLE_IDS, SCHOOL_EMAIL_DOMAINS, type RoleId } from '@ulaw/shared';
import { useDevLogin, useSession } from '../../api/auth';
import { homePath } from '../../app/paths';
import { SHOW_DEMO } from '../../lib/env';
import styles from './LoginPage.module.css';

const POINTS = [
  'Nộp đơn trực tuyến, không cần đến phòng Đào tạo',
  'Theo dõi trạng thái đơn mọi lúc',
  'Nhận yêu cầu bổ sung và kết quả ngay trên cổng',
];

/**
 * Trang Đăng nhập. Hiện đang đăng nhập thử theo vai trò (API giả);
 * giai đoạn 2 thay bằng Google OAuth.
 * @returns  giao diện trang; đã đăng nhập thì chuyển vào ứng dụng
 */
export function LoginPage() {
  const session = useSession();
  const login = useDevLogin();
  const location = useLocation();
  const [role, setRole] = useState<RoleId>('nguoi-nop-don');

  // Đang kiểm tra phiên: chưa vẽ gì, tránh nháy trang đăng nhập
  if (session.isPending) return null;

  // Đã đăng nhập: mở trang trong link nếu có (AppLayout gửi kèm), không thì trang chính của vai trò
  if (session.data) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? homePath(session.data.role)} replace />;
  }

  return (
    <main className={styles.login}>
      <section className={styles.signin}>
        <img className={styles.logo} src="/assets/logo.png" alt="Logo Trường Đại học Luật TP. Hồ Chí Minh" />
        <p className={styles.school}>Trường Đại học Luật TP. Hồ Chí Minh</p>
        <h1>Cổng xử lí đơn</h1>
        <p className={styles.lead}>Đăng nhập để đăng ký xét miễn môn học và theo dõi trạng thái đơn của bạn.</p>

        {/* JUST FOR DEMO: START · đăng nhập thử theo vai trò đang chọn (API giả). Bản thật: chuyển sang Google OAuth. */}
        <button
          type="button"
          className={styles.googleButton}
          disabled={login.isPending}
          onClick={() => login.mutate({ role })}
        >
          <GoogleIcon />
          {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập bằng email trường'}
        </button>
        {/* JUST FOR DEMO: END */}
        <p className={styles.hint}>Dùng tài khoản Google do trường cấp (@{SCHOOL_EMAIL_DOMAINS[0]}).</p>
        {login.isError && (
          <p className={styles.message} role="alert">
            {login.error.message}
          </p>
        )}

        <ul className={styles.points}>
          {POINTS.map((point) => (
            <li key={point}>
              <CheckIcon />
              {point}
            </li>
          ))}
        </ul>

        {/* JUST FOR DEMO: START · chọn vai trò khi đăng nhập, chỉ hiện khi VITE_APP_ENV = "dev".
            Bản thật: vai trò do máy chủ trả về theo tài khoản. */}
        {SHOW_DEMO && (
          <fieldset className={styles.rolePick}>
            <legend>Bản thử nghiệm · đăng nhập với vai trò</legend>
            {ROLE_IDS.map((id) => (
              <label key={id}>
                <input
                  type="radio"
                  name="loginRole"
                  value={id}
                  checked={role === id}
                  onChange={() => setRole(id)}
                />
                <span>{ROLES[id].name}</span>
              </label>
            ))}
          </fieldset>
        )}
        {/* JUST FOR DEMO: END */}
      </section>
    </main>
  );
}

/** Logo Google trên nút đăng nhập. */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Dấu tích trước mỗi ý trong danh sách lợi ích. */
function CheckIcon() {
  return (
    <span className={styles.check} aria-hidden="true">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 12 4 4 8-8" />
      </svg>
    </span>
  );
}
