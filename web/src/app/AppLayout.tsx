/* Khung ứng dụng sau khi đăng nhập: thanh menu + vùng nội dung của từng trang.
   Màn hình rộng: menu nằm ngang trên cùng. Màn hình hẹp: thanh trên cùng + menu trượt ra từ bên trái. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { PAGES, canSeePage, type Page } from '@ulaw/shared';
import { useLogout, useSession } from '../api/auth';
import { Avatar } from '../components/Avatar';
import { AccountMenu } from './AccountMenu';
import { DemoRoleSwitch } from '../features/auth/DemoRoleSwitch';
import { SHOW_DEMO } from '../lib/env';
import { useMediaQuery } from '../lib/useMediaQuery';
import { LOGIN_PATH, PAGE_LABEL, PAGE_PATH } from './paths';
import styles from './AppLayout.module.css';

/**
 * Khung ứng dụng. Chưa đăng nhập thì chuyển về trang Đăng nhập, nhớ trang đang mở để quay lại sau.
 * @returns  thanh menu + trang hiện tại (Outlet)
 */
export function AppLayout() {
  const session = useSession();
  const logout = useLogout();
  const location = useLocation();

  // Menu trượt chỉ có ở màn hình hẹp; màn hình rộng menu luôn hiện
  const narrow = useMediaQuery('(max-width: 960px)');
  const [open, setOpen] = useState(false);
  const drawerOpen = narrow && open;
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Mở menu: đưa con trỏ bàn phím vào mục đầu tiên; bấm Esc thì đóng
  useEffect(() => {
    if (!drawerOpen) return;
    navRef.current?.querySelector('a')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Đang kiểm tra phiên, hoặc lỗi khi gọi API
  if (session.isPending) return null;
  if (session.isError) return <p className={styles.error}>Không tải được phiên đăng nhập: {session.error.message}</p>;

  // Chưa đăng nhập: về trang Đăng nhập, gửi kèm trang đang mở (vừa bấm Đăng xuất thì không nhớ trang cũ)
  if (!session.data) {
    const from = logout.isIdle ? location.pathname : undefined;
    return <Navigate to={LOGIN_PATH} replace state={from ? { from } : null} />;
  }
  const { user, role } = session.data;

  /** Đóng menu trượt và trả con trỏ bàn phím về nút mở menu. */
  function closeDrawer() {
    setOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <div className={styles.shell}>
      {/* Thanh trên cùng: chỉ hiện ở màn hình hẹp */}
      <header className={styles.topbar}>
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          aria-label="Mở menu"
          aria-controls="drawer"
          aria-expanded={drawerOpen}
          onClick={() => setOpen(true)}
        >
          <MenuIcon />
        </button>
        <img src="/assets/logo.png" alt="" />
        <span className={styles.appName}>Cổng xử lí đơn</span>
        <AccountMenu user={user} onLogout={() => logout.mutate()} logoutPending={logout.isPending} />
      </header>
      {drawerOpen && <div className={styles.backdrop} onClick={closeDrawer} />}

      {/* Menu: các trang theo vai trò + tài khoản và nút đăng xuất */}
      <aside id="drawer" className={`${styles.drawer} ${drawerOpen ? styles.open : ''}`} aria-label="Menu" inert={narrow && !open}>
        <div className={styles.brand}>
          <img src="/assets/logo.png" alt="Logo Trường Đại học Luật TP. Hồ Chí Minh" />
          <div>
            <p className={styles.school}>Trường ĐH Luật TP.HCM</p>
            <p className={styles.appName}>Cổng xử lí đơn</p>
          </div>
          <button type="button" className={`${styles.iconButton} ${styles.close}`} aria-label="Đóng menu" onClick={closeDrawer}>
            <CloseIcon />
          </button>
        </div>

        <nav ref={navRef} className={styles.nav} aria-label="Điều hướng">
          {PAGES.filter((page) => canSeePage(role, page)).map((page) => (
            <NavLink key={page} to={PAGE_PATH[page]} onClick={() => setOpen(false)}>
              {PAGE_ICON[page]}
              <span>{PAGE_LABEL[page]}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.spacer} />

        {/* JUST FOR DEMO: START · đổi vai trò để thử, chỉ hiện khi VITE_APP_ENV = "dev" */}
        {SHOW_DEMO && <DemoRoleSwitch />}
        {/* JUST FOR DEMO: END */}

        <div className={styles.foot}>
          <Avatar name={user.name} />
          <div className={styles.account}>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <Outlet />
      </div>
    </div>
  );
}

/* ---------- biểu tượng (chuyển từ artifact/index.html) ---------- */

/**
 * Khung SVG chung cho các biểu tượng nét.
 * @param children  các nét vẽ (path, circle…)
 * @param size      cỡ, mặc định 20px
 * @returns         thẻ <svg> trình đọc màn hình bỏ qua
 */
function Icon({ children, size = 20, strokeWidth = 1.8 }: { children: ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const PAGE_ICON: Record<Page, ReactNode> = {
  profile: (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </Icon>
  ),
  forms: (
    <Icon>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </Icon>
  ),
  formTypes: (
    <Icon>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </Icon>
  ),
  accounts: (
    <Icon>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 3-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.2.6 3.5 2.4 3.5 5.2" />
    </Icon>
  ),
};

function MenuIcon() {
  return (
    <Icon size={22} strokeWidth={2}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

function CloseIcon() {
  return (
    <Icon strokeWidth={2}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

function LogoutIcon() {
  return (
    <Icon>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </Icon>
  );
}
