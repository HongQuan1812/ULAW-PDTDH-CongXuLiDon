/* HỢP ĐỒNG API: mỗi nhóm API một file, gom lại ở đây. */
import { AUTH_ENDPOINTS } from './auth';
import { FORM_TYPE_ENDPOINTS } from './form-types';
import { FORM_ENDPOINTS } from './form';
import { FORMS_ENDPOINTS } from './forms';
import { HEALTH_ENDPOINTS } from './health';
import { PROFILE_ENDPOINTS } from './profile';

export * from './common';
export * from './auth';
export * from './form-types';
export * from './form';
export * from './forms';
export * from './health';
export * from './profile';

/** Mọi đường dẫn API, theo nhóm. Vd ENDPOINTS.auth.me */
export const ENDPOINTS = {
  auth: AUTH_ENDPOINTS,
  form: FORM_ENDPOINTS,
  forms: FORMS_ENDPOINTS,
  formTypes: FORM_TYPE_ENDPOINTS,
  health: HEALTH_ENDPOINTS,
  profile: PROFILE_ENDPOINTS,
} as const;
