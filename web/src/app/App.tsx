import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { handleUnauthorized } from '../api/auth';
import { ToastProvider } from '../components/Toast';
import { UndoProvider } from '../features/undo/UndoProvider';
import { router } from './router';

/* Nơi TanStack Query lưu tạm kết quả gọi API.
   Lỗi thì không tự gọi lại; quay lại tab cũng không tự tải lại.
   API nào báo chưa đăng nhập (401) thì chuyển về trang Đăng nhập. */
const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error) => handleUnauthorized(queryClient, error) }),
  mutationCache: new MutationCache({ onError: (error) => handleUnauthorized(queryClient, error) }),
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

/**
 * Gốc của ứng dụng: bọc TanStack Query (gọi API, lưu tạm) và Router (chuyển trang).
 * @returns  toàn bộ ứng dụng
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <UndoProvider>
          <RouterProvider router={router} />
        </UndoProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
