/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true": dùng API giả (MSW). */
  readonly VITE_USE_MOCKS?: string;
  /** "dev": hiện các phần JUST FOR DEMO. */
  readonly VITE_APP_ENV?: string;
  /** Tỉ lệ API giả trả lỗi 500 ngẫu nhiên, từ 0 đến 1, vd "0.3". */
  readonly VITE_MOCK_FAILURE_RATE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
