/* HỢP ĐỒNG API: mỗi nhóm API một file, gom lại ở đây. */
import { ACCOUNT_ENDPOINTS } from './accounts';
import { AUTH_ENDPOINTS } from './auth';
import { EMAIL_ENDPOINTS } from './email';
import { EXPORT_ENDPOINTS } from './exports';
import { FILE_ENDPOINTS } from './files';
import { FORM_NOTE_ENDPOINTS } from './form-notes';
import { FORM_TYPE_ENDPOINTS } from './form-types';
import { FORM_ENDPOINTS } from './form';
import { FORMS_ENDPOINTS } from './forms';
import { HEALTH_ENDPOINTS } from './health';
import { PROFILE_ENDPOINTS } from './profile';

export * from './common';
export * from './accounts';
export * from './auth';
export * from './email';
export * from './exports';
export * from './files';
export * from './form-notes';
export * from './form-types';
export * from './form';
export * from './forms';
export * from './health';
export * from './profile';

/** Mọi đường dẫn API, theo nhóm. Vd ENDPOINTS.auth.me */
export const ENDPOINTS = {
  accounts: ACCOUNT_ENDPOINTS,
  auth: AUTH_ENDPOINTS,
  email: EMAIL_ENDPOINTS,
  exports: EXPORT_ENDPOINTS,
  form: FORM_ENDPOINTS,
  formNotes: FORM_NOTE_ENDPOINTS,
  files: FILE_ENDPOINTS,
  forms: FORMS_ENDPOINTS,
  formTypes: FORM_TYPE_ENDPOINTS,
  health: HEALTH_ENDPOINTS,
  profile: PROFILE_ENDPOINTS,
} as const;
