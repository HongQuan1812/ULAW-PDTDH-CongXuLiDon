import { authHandlers } from './auth';
import { formTypeHandlers } from './form-types';
import { formHandlers } from './forms';
import { healthHandlers } from './health';
import { profileHandlers } from './profile';

export const handlers = [...authHandlers, ...formHandlers, ...formTypeHandlers, ...healthHandlers, ...profileHandlers];
