/* Trang Cấu hình (#/cau-hinh): mỗi trang trong SETTINGS_PAGES một thẻ, bấm thì mở trang đó (các trang giữ nguyên, không đổi gì).
   Vai trò chỉ thấy thẻ của trang mình được vào (ROLES). */
import { Link } from 'react-router';
import { SETTINGS_PAGES, canSeePage } from '@ulaw/shared';
import { useAuth } from '../../features/auth/useAuth';
import { PAGE_ICON } from '../../app/pageIcons';
import { PAGE_LABEL, PAGE_PATH } from '../../app/paths';
import profileStyles from '../profile/ProfilePage.module.css';
import styles from './SettingsPage.module.css';

/** Dòng mô tả dưới tên mỗi thẻ */
const SETTINGS_PAGE_DESCRIPTION: Record<(typeof SETTINGS_PAGES)[number], string> = {
  emailSettings: 'Người gửi, chữ kí, thư tự động khi đơn đổi trạng thái',
  dataSources: 'Kết nối tới database trường',
  backups: 'Nơi lưu, sao lưu ngay, lịch định kì, lịch sử',
  holidays: 'Lễ, Tết, nghỉ bù: hạn xử lí đơn không tính các ngày này',
};

/**
 * Trang Cấu hình: các thẻ dẫn tới những trang cấu hình vai trò hiện tại được vào.
 * @returns  lưới thẻ
 */
export function SettingsPage() {
  const { role } = useAuth();
  const visiblePages = SETTINGS_PAGES.filter((page) => canSeePage(role, page));

  return (
    <div className={profileStyles.page}>
      {/* Mỗi trang một thẻ: biểu tượng, tên, mô tả */}
      <nav className={styles.grid} aria-label="Các trang cấu hình">
        {visiblePages.map((page) => (
          <Link key={page} to={PAGE_PATH[page]} className={styles.card}>
            <span className={styles.icon}>{PAGE_ICON[page]}</span>
            <strong className={styles.title}>{PAGE_LABEL[page]}</strong>
            <span className={styles.description}>{SETTINGS_PAGE_DESCRIPTION[page]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
