/* Nút "‹ Quay lại …" của các trang đơn (như goBack và nhãn #formBack của artifact/js/nav.js). */
import { useLocation, useNavigate } from 'react-router';
import { ROLES } from '@ulaw/shared';
import { homePath, PAGE_LABEL, readPreviousPageLabel } from '../../app/paths';
import { useAuth } from '../../features/auth/useAuth';

/**
 * Cách quay lại từ một trang đơn.
 * Trang trước có gửi kèm tên (vd mở từ Thông tin cá nhân) thì về trang đó như nút Back;
 * mở thẳng đường dẫn (không có trang trước) thì về trang chính của vai trò.
 * @returns  backLabel: tên trang sẽ về, vd 'Thông tin cá nhân' · goBack: hàm quay lại ·
 *           previousPageLabel: tên trang trước nếu có (undefined khi mở thẳng đường dẫn)
 */
export function useLeavePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const previousPageLabel = location.key === 'default' ? undefined : readPreviousPageLabel(location.state);

  if (previousPageLabel) return { backLabel: previousPageLabel, goBack: () => navigate(-1), previousPageLabel };
  return {
    backLabel: PAGE_LABEL[ROLES[role].home],
    goBack: () => navigate(homePath(role), { replace: true }),
    previousPageLabel,
  };
}
