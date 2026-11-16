import { existsSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { msw } from 'msw/vite';

/** Giá trị dùng khi .env.dev không đặt biến. */
const DEFAULT_WEB_PORT = 5173;
const DEFAULT_API_PROXY_TARGET = 'http://localhost:3000';

/** Tệp biến môi trường dev ở thư mục gốc repo (Vite chạy trong thư mục web/). */
const DEV_ENV_FILE = '../.env.dev';

/**
 * Cấu hình Vite. Biến đọc từ .env.dev ở thư mục gốc (khi chạy dev và test; build thì không, bản build lấy biến
 * đặt sẵn, vd ENV trong web/Dockerfile). Biến đã đặt sẵn (compose truyền vào container) không bị ghi đè.
 * WEB_PORT, API_PROXY_TARGET không có tiền tố VITE_ nên chỉ tệp này đọc được, không đưa vào mã chạy trong trình duyệt.
 * @param command  'serve' khi `vite` / vitest, 'build' khi `vite build`
 * @param mode     chế độ chạy, vd 'development' khi `vite`, 'production' khi `vite build`
 * @returns        cấu hình Vite
 */
export default defineConfig(({ command, mode }) => {
  // Nạp .env.dev vào process.env: Vite lấy các biến VITE_* trong process.env đưa vào import.meta.env
  if (command === 'serve' && existsSync(DEV_ENV_FILE)) process.loadEnvFile(DEV_ENV_FILE);

  // Mọi biến (tham số '' : không lọc theo tiền tố), gồm cả biến vừa nạp
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
      // Tên miền được mở ngoài localhost / IP: *.nip.io (vd https://192.168.32.93.nip.io:5173, trỏ về IP trong tên),
      // để đăng nhập Google từ máy khác trong LAN (Google không nhận IP làm redirect URI)
      allowedHosts: ['.nip.io'],
      // Request /api tới backend thật (tắt backend giả, hoặc nhóm trong VITE_REAL_BACKEND_GROUPS khi bật) được chuyển sang đây
      proxy: { '/api': apiProxyTarget },
    },
  };
});
