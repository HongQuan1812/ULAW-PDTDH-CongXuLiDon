import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/global.css';

/**
 * Bật API giả (MSW) nếu VITE_USE_MOCKS = "true".
 * Gọi trước khi vẽ giao diện, để request đầu tiên cũng được chặn.
 * @returns  Promise xong khi MSW đã sẵn sàng (hoặc ngay lập tức nếu không dùng API giả)
 */
async function enableMocking(): Promise<void> {
  // Không dùng API giả: bỏ qua (code MSW không bị đưa vào bản build)
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;

  // Tải MSW và bật; request không có handler thì cho đi tiếp ra mạng
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledFrame: 'bypass' });
}

// Bật API giả xong mới vẽ ứng dụng vào <div id="root">
enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
