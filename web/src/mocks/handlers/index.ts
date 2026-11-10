import { authHandlers } from './auth';
import { formTypeHandlers } from './form-types';
import { formHandlers } from './forms';
import { healthHandlers } from './health';
import { profileHandlers } from './profile';
import { randomFailureHandlers } from './random-failure';

/* Lỗi ngẫu nhiên đứng đầu: được xét trước handler thật của từng API. */
export const handlers = [
  ...randomFailureHandlers,
  ...authHandlers,
  ...formHandlers,
  ...formTypeHandlers,
  ...healthHandlers,
  ...profileHandlers,
];
