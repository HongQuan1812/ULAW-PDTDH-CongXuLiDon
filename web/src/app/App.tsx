import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { router } from './router';

/* Nơi TanStack Query lưu tạm kết quả gọi API.
   Lỗi thì không tự gọi lại; quay lại tab cũng không tự tải lại. */
const queryClient = new QueryClient({
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
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
