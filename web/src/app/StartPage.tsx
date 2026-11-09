/* Trang tạm để kiểm tra phần nền (Vite, React, MSW, shared, màu sắc).
   Sẽ thay bằng trang Đăng nhập ở bước sau. */
import { useQuery } from '@tanstack/react-query';
import { FORM_STATUSES, ROLES, ROLE_IDS } from '@ulaw/shared';
import { apiFetch } from '../api/client';
import { StatusPill } from '../components/StatusPill';
import styles from './StartPage.module.css';

/**
 * Trang tạm: hiện logo, kết quả gọi thử API, các trạng thái đơn và vai trò.
 * @returns  giao diện trang
 */
export function StartPage() {
  // Gọi thử GET /api/health
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<{ ok: boolean; mock?: boolean }>('/health'),
  });

  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <img src="/assets/logo.png" alt="Logo Trường Đại học Luật TP. Hồ Chí Minh" />
        <div>
          <div className={styles.school}>Phòng Đào tạo Đại học · Trường ĐH Luật TP.HCM</div>
          <h1>Cổng xử lí đơn</h1>
        </div>
      </div>

      <section className={styles.card}>
        <h2>API</h2>
        {health.isPending && <p className={styles.muted}>Đang kiểm tra…</p>}
        {health.isError && <p className={styles.err}>Không gọi được API: {health.error.message}</p>}
        {health.data && (
          <p className={styles.ok}>
            API trả lời bình thường{health.data.mock ? ' (đang dùng API giả — MSW)' : ''}.
          </p>
        )}
      </section>

      <section className={styles.card}>
        <h2>Trạng thái đơn</h2>
        <div className={styles.pills}>
          {FORM_STATUSES.map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Vai trò</h2>
        <ul>
          {ROLE_IDS.map((id) => (
            <li key={id}>
              <b>{ROLES[id].name}</b> — {ROLES[id].permissions.length} quyền
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
