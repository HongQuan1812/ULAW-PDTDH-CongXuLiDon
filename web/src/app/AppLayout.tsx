/* Khung ứng dụng sau khi đăng nhập: thanh menu + vùng nội dung của từng trang.
   Đủ chỗ: menu nằm ngang trên cùng; thiếu chỗ thì ẩn tên tài khoản và nhãn ô vai trò trước;
   vẫn không đủ: thanh trên cùng + menu trượt ra từ bên trái; thanh trên cùng thiếu chỗ thì ẩn dải icon, rồi ẩn tên ứng dụng.
   Chỉ xét theo chỗ trống, không theo bề rộng màn hình cố định, nên vai trò nào (nhiều hay ít mục) cũng thu gọn theo cùng một luật. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { PAGES, canSeePage, type Page } from '@ulaw/shared';
import { useSession } from '../api/auth';
import { Avatar } from '../components/Avatar';
import { LoadError } from '../components/LoadError';
import { RefreshButton } from '../components/RefreshButton';
import { AccountMenu } from './AccountMenu';
import { DemoRoleSwitch } from '../features/auth/DemoRoleSwitch';
import { useLogoutAction } from '../features/auth/useLogoutAction';
import { SHOW_DEMO } from '../lib/env';
import { LOGIN_PATH, ONBOARDING_PATH, PAGE_LABEL, PAGE_PATH } from './paths';
import styles from './AppLayout.module.css';

/**
 * Khung ứng dụng. Chưa đăng nhập thì chuyển về trang Đăng nhập, nhớ trang đang mở để quay lại sau.
 * @returns  thanh menu + trang hiện tại (Outlet)
 */
export function AppLayout() {
  const session = useSession();
  const logout = useLogoutAction();
  const location = useLocation();

  // Không đủ chỗ thì thu gọn dần: ẩn tên tài khoản và nhãn ô vai trò → menu trượt → ẩn dải icon → ẩn tên ứng dụng
  const { navRef, iconNavRef, appNameRef, stage } = useMenuStage(session.data?.role);
  const narrow = DRAWER_STAGES.includes(stage);
  const menuMode = narrow ? 'drawer' : stage === 'compact' ? 'compact' : 'bar';
  const topbarMode = stage === 'drawerNoIcons' ? 'noIcons' : stage === 'drawerMinimal' ? 'minimal' : 'full';
  const [open, setOpen] = useState(false);
  const drawerOpen = narrow && open;
  // Menu tài khoản: giữ mở / đóng ở đây để đổi kiểu menu (ngang ↔ trượt) thì menu đang mở vẫn mở
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
  if (session.isError) {
    return (
      <div className={styles.error}>
        <LoadError message={`Không tải được phiên đăng nhập. ${session.error.message}`} />
        <RefreshButton query={session} label="phiên đăng nhập" />
      </div>
    );
  }

  // Chưa đăng nhập: về trang Đăng nhập, gửi kèm trang đang mở (vừa bấm Đăng xuất thì không nhớ trang cũ)
  if (!session.data) {
    const from = logout.isIdle ? location.pathname : undefined;
    return <Navigate to={LOGIN_PATH} replace state={from ? { from } : null} />;
  }
  // Lần đầu đăng nhập, chưa xác nhận họ tên: sang màn Bổ sung thông tin
  if (!session.data.profileCompleted) return <Navigate to={ONBOARDING_PATH} replace />;
  const { user, role } = session.data;
  const visiblePages = PAGES.filter((page) => canSeePage(role, page));

  /** Đóng menu trượt và trả con trỏ bàn phím về nút mở menu. */
  function closeDrawer() {
    setOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <div className={styles.shell} data-menu={menuMode} data-topbar={topbarMode}>
      {/* Thanh trên cùng: chỉ hiện khi dùng menu trượt. ☰ · logo · tên · icon các trang · menu tài khoản */}
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
        <span ref={appNameRef} className={styles.appName}>Cổng xử lí đơn</span>

        {/* Các trang dạng icon (rê chuột hiện tên trang), để chuyển trang nhanh mà không cần mở menu trượt */}
        <nav ref={iconNavRef} className={styles.iconNav} aria-label="Chuyển trang nhanh">
          {visiblePages.map((page) => (
            <NavLink key={page} to={PAGE_PATH[page]} aria-label={PAGE_LABEL[page]} title={PAGE_LABEL[page]}>
              {PAGE_ICON[page]}
            </NavLink>
          ))}
        </nav>

        {/* chỉ một menu tài khoản tại một lúc: ở đây khi dùng menu trượt, ở cuối menu ngang khi không */}
        {narrow && (
          <AccountMenu
            user={user}
            onLogout={logout.logOut}
            logoutPending={logout.isPending}
            open={accountMenuOpen}
            setOpen={setAccountMenuOpen}
          />
        )}
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
          {visiblePages.map((page) => (
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
          {/* Màn hình rộng: bấm avatar thì thả đúng menu như màn hình hẹp. Màn hình hẹp: chỉ hiện hình (thanh trên cùng đã có menu) */}
          {narrow ? (
            <Avatar name={user.name} />
          ) : (
            <AccountMenu
              user={user}
              onLogout={logout.logOut}
              logoutPending={logout.isPending}
              open={accountMenuOpen}
              setOpen={setAccountMenuOpen}
            />
          )}
          <div className={styles.account}>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          {/* Chỉ hiện trong menu trượt (màn hình hẹp): hàng riêng, rộng hết chiều ngang, nằm dưới avatar + tên + email */}
          <button
            type="button"
            className={styles.logoutText}
            disabled={logout.isPending}
            onClick={logout.logOut}
          >
            {logout.isPending ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.logoutIcon}`}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            disabled={logout.isPending}
            onClick={logout.logOut}
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

/* Các mức thu gọn, theo thứ tự: menu ngang đủ cả · menu ngang gọn (ẩn tên tài khoản, nhãn ô vai trò) ·
   menu trượt (thanh trên cùng đủ cả) · menu trượt, thanh trên cùng ẩn dải icon · menu trượt, thanh trên cùng ẩn cả tên ứng dụng */
const MENU_STAGES = ['full', 'compact', 'drawer', 'drawerNoIcons', 'drawerMinimal'] as const;
type MenuStage = (typeof MENU_STAGES)[number];
/** Các mức dùng menu trượt */
const DRAWER_STAGES: readonly MenuStage[] = ['drawer', 'drawerNoIcons', 'drawerMinimal'];

/**
 * Chọn mức thu gọn của menu theo chỗ trống, thu gọn theo một chiều qua MENU_STAGES.
 * Ở mỗi mức, đo phần sẽ bị ẩn ở mức sau (menu ngang: nav các trang; menu trượt: dải icon, rồi tên ứng dụng trên thanh trên cùng);
 * phần đó bị bóp (nội dung tràn ra ngoài khung) thì xuống mức tiếp theo.
 * Đây là luật duy nhất, không có mốc bề rộng màn hình cố định: màn hình điện thoại cũng ra menu trượt vì đo thấy hết chỗ.
 * Đổi bề ngang cửa sổ hoặc đổi vai trò (số mục đổi) thì thử lại từ mức "đủ cả" rồi đo;
 * việc thử chạy trước khi vẽ nên không nháy.
 * @param role  vai trò hiện tại; đổi thì đo lại
 * @returns     navRef gắn vào nav các trang; iconNavRef, appNameRef gắn vào dải icon và tên ứng dụng trên thanh trên cùng;
 *              stage = mức thu gọn hiện tại
 */
function useMenuStage(role: string | undefined) {
  const navRef = useRef<HTMLElement>(null);
  const iconNavRef = useRef<HTMLElement>(null);
  const appNameRef = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<MenuStage>('full');
  const measuredWidthRef = useRef(window.innerWidth);

  // Đổi vai trò: thử lại từ mức đủ cả rồi đo
  useLayoutEffect(() => setStage('full'), [role]);

  // Đo khi mới vẽ, khi đổi bề ngang cửa sổ và khi font tải xong (chữ rộng ra)
  useLayoutEffect(() => {
    // Phần đang đo bị tràn: xuống mức tiếp theo (mức cuối thì thôi, không còn gì để ẩn)
    const check = () => {
      const measuredElement = { full: navRef, compact: navRef, drawer: iconNavRef, drawerNoIcons: appNameRef, drawerMinimal: null }[stage]?.current;
      const nextStage = MENU_STAGES[MENU_STAGES.indexOf(stage) + 1];
      if (nextStage && measuredElement && measuredElement.scrollWidth > measuredElement.clientWidth) setStage(nextStage);
    };

    // Đổi bề ngang: đang thu gọn thì thử lại mức đủ cả (lần vẽ sau đo lại); đang đủ cả thì đo luôn.
    // Chỉ đổi chiều cao (điện thoại ẩn / hiện thanh địa chỉ khi cuộn) thì bỏ qua
    const retry = () => {
      if (window.innerWidth === measuredWidthRef.current) return;
      measuredWidthRef.current = window.innerWidth;
      if (stage === 'full') check();
      else setStage('full');
    };

    check();
    window.addEventListener('resize', retry);
    document.fonts?.ready.then(check);
    return () => window.removeEventListener('resize', retry);
  }, [stage, role]);

  return { navRef, iconNavRef, appNameRef, stage };
}

/* ---------- biểu tượng ---------- */

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
  // Loại đơn: chồng nhiều lớp (nhiều loại, nhiều phiên bản), khác hẳn hình tờ giấy của Quản lí đơn
  formTypes: (
    <Icon>
      <path d="M12 3 3 7.5l9 4.5 9-4.5z" />
      <path d="M3 12l9 4.5 9-4.5" />
      <path d="M3 16.5 12 21l9-4.5" />
    </Icon>
  ),
  accounts: (
    <Icon>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 3-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.2.6 3.5 2.4 3.5 5.2" />
    </Icon>
  ),
  // Cấu hình email: phong bì
  emailSettings: (
    <Icon>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
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
