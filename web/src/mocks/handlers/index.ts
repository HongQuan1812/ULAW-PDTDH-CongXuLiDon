import { accountHandlers } from './accounts';
import { authHandlers } from './auth';
import { emailHandlers } from './email';
import { exportHandlers } from './exports';
import { fileHandlers } from './files';
import { formTypeHandlers } from './form-types';
import { formHandlers } from './form';
import { formsHandlers } from './forms';
import { healthHandlers } from './health';
import { profileHandlers } from './profile';
import { randomFailureHandlers } from './random-failure';

/* Lỗi ngẫu nhiên đứng đầu: được xét trước handler thật của từng API. */
export const handlers = [
  ...randomFailureHandlers,
  ...authHandlers,
  ...accountHandlers,
  ...emailHandlers,
  // forms trước form: /forms/mine, /forms/handled, /forms/cccds phải được xét trước /forms/:code
  ...formsHandlers,
  // mẫu xuất file trước form-types: /form-types/:id/export-templates không bị hiểu nhầm; /forms/:code/export trước /forms/:code
  ...exportHandlers,
  ...formHandlers,
  ...fileHandlers,
  ...formTypeHandlers,
  ...healthHandlers,
  ...profileHandlers,
];
