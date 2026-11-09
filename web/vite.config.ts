import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { msw } from 'msw/vite';

export default defineConfig({
  // msw: phục vụ tệp mockServiceWorker.js khi chạy dev (không cần chép vào public/)
  plugins: [react(), msw({ mode: 'worker-only' })],
  server: { port: 5173 },
});
