/* Nút "‹ Quay lại Cấu hình" ở đầu các trang trong Cấu hình (SETTINGS_PAGES). */
import { useNavigate } from 'react-router';
import { PAGE_LABEL, PAGE_PATH } from '../../app/paths';
import { BackButton } from '../../components/BackButton';

/**
 * Nút quay về trang Cấu hình (BackButton dùng chung).
 * @returns  nút chuyển sang trang Cấu hình
 */
export function BackToSettings() {
  const navigate = useNavigate();
  return <BackButton label={PAGE_LABEL.settings} onClick={() => navigate(PAGE_PATH.settings)} />;
}
