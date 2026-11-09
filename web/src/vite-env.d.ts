/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true": dùng API giả (MSW). */
  readonly VITE_USE_MOCKS?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
