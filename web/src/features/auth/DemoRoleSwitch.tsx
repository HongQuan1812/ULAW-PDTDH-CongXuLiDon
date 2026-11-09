/* JUST FOR DEMO: START · cả file: ô "Vai trò (thử nghiệm)" trong menu để đổi vai trò khi đang dùng.
   Chỉ hiện khi VITE_APP_ENV = "dev". Bản thật: không có, vai trò do máy chủ quyết định. */
import { useId } from 'react';
import { useNavigate } from 'react-router';
import { ROLES, ROLE_IDS, type RoleId } from '@ulaw/shared';
import { useDevLogin } from '../../api/auth';
import { homePath } from '../../app/paths';
import { useAuth } from './useAuth';
import styles from './DemoRoleSwitch.module.css';

/**
 * Ô chọn để đổi vai trò mà không cần đăng xuất. Đổi xong thì mở trang chính của vai trò mới.
 * @param onSwitched  gọi sau khi đổi xong (vd để đóng menu đang mở)
 * @returns           nhãn + ô chọn vai trò
 */
export function DemoRoleSwitch({ onSwitched }: { onSwitched?: () => void }) {
  const { role } = useAuth();
  const selectId = useId(); // có thể có 2 ô cùng lúc (menu trượt, menu tài khoản) nên id phải riêng
  const login = useDevLogin();
  const navigate = useNavigate();

  /**
   * Đăng nhập lại với vai trò mới, xong thì về trang chính của vai trò đó.
   * @param next  vai trò vừa chọn
   */
  function switchRole(next: RoleId) {
    login.mutate(
      { role: next },
      {
        onSuccess: () => {
          navigate(homePath(next));
          onSwitched?.();
        },
      },
    );
  }

  return (
    <div className={styles.roleSwitch}>
      <label htmlFor={selectId}>Vai trò (thử nghiệm)</label>
      <select
        id={selectId}
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
