import { authHandlers } from './auth';
import { healthHandlers } from './health';
import { profileHandlers } from './profile';

export const handlers = [...authHandlers, ...healthHandlers, ...profileHandlers];
