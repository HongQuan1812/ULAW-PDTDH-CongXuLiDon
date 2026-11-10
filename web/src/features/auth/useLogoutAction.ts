/* Đăng xuất kèm báo lỗi: dùng chung cho mọi nút Đăng xuất (thanh trên cùng, menu tài khoản, menu trượt, màn Bổ sung thông tin). */
import { AUTH_MESSAGES } from '@ulaw/shared';
import { useLogout } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/Toast';

/**
 * Lệnh đăng xuất. Thành công thì phiên bị xóa, trang tự về Đăng nhập; lỗi thì hiện toast đỏ, người dùng vẫn ở lại.
 * @returns  logOut() để gọi khi bấm nút, isPending (đang đăng xuất, để khóa nút),
 *           isIdle (chưa bấm Đăng xuất lần nào, để biết có nên nhớ trang đang mở)
 */
export function useLogoutAction() {
  const logout = useLogout();
  const toast = useToast();

  // Gửi yêu cầu đăng xuất; máy chủ báo lỗi thì hiện câu của máy chủ, mất mạng thì câu chung
  const logOut = () =>
    logout.mutate(undefined, {
      onError: (error) => toast(error instanceof ApiError ? error.message : AUTH_MESSAGES.logoutFailed, 'error'),
    });

  return { logOut, isPending: logout.isPending, isIdle: logout.isIdle };
}
