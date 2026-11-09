/* HỢP ĐỒNG API: mỗi nhóm API một file, gom lại ở đây. */
import { AUTH_ENDPOINTS } from './auth';
import { HEALTH_ENDPOINTS } from './health';
import { PROFILE_ENDPOINTS } from './profile';

export * from './common';
export * from './auth';
export * from './health';
export * from './profile';

/** Mọi đường dẫn API, theo nhóm. Vd ENDPOINTS.auth.me */
export const ENDPOINTS = {
  auth: AUTH_ENDPOINTS,
  health: HEALTH_ENDPOINTS,
  profile: PROFILE_ENDPOINTS,
} as const;
