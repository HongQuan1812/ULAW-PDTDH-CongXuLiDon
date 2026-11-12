import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { msw } from 'msw/vite';

/** Địa chỉ backend lúc chạy dev (API_PORT trong api/.env). */
const BACKEND_URL = 'http://localhost:3000';

export default defineConfig({
  // msw: phục vụ tệp mockServiceWorker.js khi chạy dev (không cần chép vào public/)
  plugins: [react(), msw({ mode: 'worker-only' })],
  server: {
    port: 5173,
    // Request /api mà MSW cho đi tiếp (nhóm trong REAL_API_GROUPS, mocks/realApiGroups.ts) được chuyển sang backend
    proxy: { '/api': BACKEND_URL },
  },
});
