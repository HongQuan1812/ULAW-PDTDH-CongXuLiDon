/* JUST FOR DEMO: START · cả file: ô "Vai trò (thử nghiệm)" trong menu để đổi vai trò khi đang dùng.
   Chỉ hiện khi VITE_APP_ENV = "dev". Bản thật: không có, vai trò do máy chủ quyết định. */
import { useNavigate } from 'react-router';
import { ROLES, ROLE_IDS, type RoleId } from '@ulaw/shared';
import { useDevLogin } from '../../api/auth';
import { homePath } from '../../app/paths';
import { useAuth } from './useAuth';
import styles from './DemoRoleSwitch.module.css';

/**
 * Ô chọn để đổi vai trò mà không cần đăng xuất. Đổi xong thì mở trang chính của vai trò mới.
 * @returns  nhãn + ô chọn vai trò
 */
export function DemoRoleSwitch() {
  const { role } = useAuth();
  const login = useDevLogin();
  const navigate = useNavigate();

  /**
   * Đăng nhập lại với vai trò mới, xong thì về trang chính của vai trò đó.
   * @param next  vai trò vừa chọn
   */
  function switchRole(next: RoleId) {
    login.mutate({ role: next }, { onSuccess: () => navigate(homePath(next)) });
  }

  return (
    <div className={styles.roleSwitch}>
      <label htmlFor="demoRole">Vai trò (thử nghiệm)</label>
      <select
        id="demoRole"
        value={role}
        disabled={login.isPending}
        onChange={(event) => switchRole(event.target.value as RoleId)}
      >
        {ROLE_IDS.map((id) => (
          <option key={id} value={id}>
            {ROLES[id].name}
          </option>
        ))}
      </select>
    </div>
  );
}
/* JUST FOR DEMO: END */
