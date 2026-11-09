/* HỢP ĐỒNG API: mỗi nhóm API một file, gom lại ở đây. */
import { AUTH_ENDPOINTS } from './auth';
import { HEALTH_ENDPOINTS } from './health';

export * from './common';
export * from './auth';
export * from './health';

/** Mọi đường dẫn API, theo nhóm. Vd ENDPOINTS.auth.me */
export const ENDPOINTS = {
  auth: AUTH_ENDPOINTS,
  health: HEALTH_ENDPOINTS,
} as const;
