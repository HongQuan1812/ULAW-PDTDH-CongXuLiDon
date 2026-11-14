/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true": bật backend giả (MSW) trong trình duyệt; các nhóm trong REAL_BACKEND_GROUPS vẫn tới backend thật. */
  readonly VITE_USE_MOCK_BACKEND?: string;
  /** "dev": hiện các phần JUST FOR DEMO. */
  readonly VITE_APP_ENV?: string;
  /** Tỉ lệ backend giả trả lỗi 500 ngẫu nhiên, từ 0 đến 1, vd "0.3". */
  readonly VITE_MOCK_BACKEND_FAILURE_RATE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
