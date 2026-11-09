/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true": dùng API giả (MSW). */
  readonly VITE_USE_MOCKS?: string;
  /** "dev": hiện các phần JUST FOR DEMO. */
  readonly VITE_APP_ENV?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
