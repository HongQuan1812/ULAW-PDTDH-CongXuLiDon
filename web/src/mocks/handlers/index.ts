import { authHandlers } from './auth';
import { formHandlers } from './forms';
import { healthHandlers } from './health';
import { profileHandlers } from './profile';

export const handlers = [...authHandlers, ...formHandlers, ...healthHandlers, ...profileHandlers];
