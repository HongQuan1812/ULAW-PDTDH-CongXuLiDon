/* Đóng gói backend thành dist/main.mjs để chạy bằng Node, kèm lệnh dist/backups/backup-before-update.mjs (docker/deploy.sh gọi).
   Gói luôn cả @ulaw/shared (mã nguồn TypeScript), các thư viện khác trong node_modules thì để nguyên. */
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts', 'src/backups/backup-before-update.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  sourcemap: true,
  dts: false,
  deps: { alwaysBundle: ['@ulaw/shared'] },
});
