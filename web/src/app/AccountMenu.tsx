/* Menu tài khoản trên thanh trên cùng (màn hình hẹp): bấm vào hình tròn có chữ cái đại diện
   thì thả xuống tên, email, đổi vai trò (JUST FOR DEMO) và nút đăng xuất. */
import { useEffect, useId, useRef, useState } from 'react';
import type { SessionUser } from '@ulaw/shared';
import { Avatar } from '../components/Avatar';
import { DemoRoleSwitch } from '../features/auth/DemoRoleSwitch';
import { SHOW_DEMO } from '../lib/env';
import styles from './AccountMenu.module.css';

/**
 * Nút hình đại diện + bảng thả xuống.
 * @param user           người đang đăng nhập
 * @param onLogout       gọi khi bấm Đăng xuất (AppLayout giữ việc đăng xuất để biết không nhớ trang cũ)
 * @param logoutPending  đang đăng xuất thì khóa nút
 * @returns              nút + bảng thả xuống khi đang mở
 */
export function AccountMenu({
  user,
  onLogout,
  logoutPending,
}: {
  user: SessionUser;
  onLogout: () => void;
  logoutPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Đang mở: bấm ra ngoài thì đóng; bấm Esc thì đóng và trả con trỏ bàn phím về nút
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={`Tài khoản: ${user.name}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={user.name} size="sm" />
      </button>

      {open && (
        <div id={panelId} className={styles.panel}>
          {/* Ai đang đăng nhập */}
          <div className={styles.account}>
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>

          {/* JUST FOR DEMO: START · đổi vai trò để thử, chỉ hiện khi VITE_APP_ENV = "dev" */}
          {SHOW_DEMO && (
            <div className={styles.demo}>
              <DemoRoleSwitch onSwitched={() => setOpen(false)} />
            </div>
          )}
          {/* JUST FOR DEMO: END */}

          <button type="button" className={styles.logout} disabled={logoutPending} onClick={onLogout}>
            {logoutPending ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      )}
    </div>
  );
}
