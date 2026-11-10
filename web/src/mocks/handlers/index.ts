import { authHandlers } from './auth';
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
  // forms trước form: /forms/mine, /forms/handled, /forms/cccds phải được xét trước /forms/:code
  ...formsHandlers,
  ...formHandlers,
  ...fileHandlers,
  ...formTypeHandlers,
  ...healthHandlers,
  ...profileHandlers,
];
