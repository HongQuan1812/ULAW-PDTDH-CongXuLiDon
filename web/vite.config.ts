import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { msw } from 'msw/vite';

/** Giá trị dùng khi web/.env.* không đặt biến. */
const DEFAULT_WEB_PORT = 5173;
const DEFAULT_API_PROXY_TARGET = 'http://localhost:3000';

/**
 * Cấu hình Vite. Cổng web và địa chỉ backend đọc từ web/.env.<mode> (vd .env.development):
 * biến không có tiền tố VITE_ nên chỉ tệp này đọc được, không đưa vào mã chạy trong trình duyệt.
 * @param mode  chế độ chạy, vd 'development' khi `vite`, 'production' khi `vite build`
 * @returns     cấu hình Vite
 */
export default defineConfig(({ mode }) => {
  // Đọc mọi biến trong web/.env.<mode> (tham số '' : không lọc theo tiền tố)
  const env = loadEnv(mode, process.cwd(), '');
  const webPort = Number(env['WEB_PORT']) || DEFAULT_WEB_PORT;
  const apiProxyTarget = env['API_PROXY_TARGET'] || DEFAULT_API_PROXY_TARGET;

  return {
    // msw: phục vụ tệp mockServiceWorker.js khi chạy dev (không cần chép vào public/)
    // basicSsl: chạy dev bằng HTTPS (chứng chỉ tự tạo), để máy khác cùng mạng LAN mở được như thật;
    // bản thật không dùng Vite, HTTPS cài ở web server của máy chủ bằng chứng chỉ của trường
    plugins: [react(), msw({ mode: 'worker-only' }), basicSsl()],
    server: {
      port: webPort,
      // Nghe trên mọi địa chỉ của máy: máy khác cùng mạng LAN mở được bằng https://<IP máy này>:<WEB_PORT>
      host: true,
      // Request /api tới backend thật (tắt backend giả, hoặc nhóm trong REAL_BACKEND_GROUPS khi bật) được chuyển sang đây
      proxy: { '/api': apiProxyTarget },
    },
  };
});
