/* Đóng gói backend thành một tệp dist/main.mjs để chạy bằng Node.
   Gói luôn cả @ulaw/shared (mã nguồn TypeScript), các thư viện khác trong node_modules thì để nguyên. */
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  sourcemap: true,
  dts: false,
  deps: { alwaysBundle: ['@ulaw/shared'] },
});
