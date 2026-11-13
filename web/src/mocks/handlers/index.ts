import { HttpHandler, passthrough, type RequestHandler } from 'msw';
import { REAL_API_GROUPS, type ApiGroup } from '../realApiGroups';
import { accountHandlers } from './accounts';
import { authHandlers } from './auth';
import { emailHandlers } from './email';
import { exportHandlers } from './exports';
import { fileHandlers } from './files';
import { formNoteHandlers } from './form-notes';
import { formTypeHandlers } from './form-types';
import { formHandlers } from './form';
import { formsHandlers } from './forms';
import { healthHandlers } from './health';
import { profileHandlers } from './profile';
import { createRandomFailureHandler } from './random-failure';

/** Handler của từng nhóm, đúng thứ tự MSW xét (nhóm đứng trước được xét trước). */
const HANDLER_GROUPS: readonly (readonly [ApiGroup, readonly HttpHandler[]])[] = [
  ['auth', authHandlers],
  ['accounts', accountHandlers],
  ['email', emailHandlers],
  // forms trước form: /forms/mine, /forms/handled, /forms/cccds phải được xét trước /forms/:code
  ['forms', formsHandlers],
  // mẫu xuất file trước form-types: /form-types/:id/export-templates không bị hiểu nhầm; /forms/:code/export trước /forms/:code
  ['exports', exportHandlers],
  // ghi chú trước form: /forms/:code/notes không bị hiểu nhầm
  ['form-notes', formNoteHandlers],
  ['form', formHandlers],
  ['files', fileHandlers],
  ['form-types', formTypeHandlers],
  ['health', healthHandlers],
  ['profile', profileHandlers],
];

/**
 * Đổi một handler giả thành handler cho request đi tiếp ra mạng (Vite chuyển sang backend).
 * Giữ cùng phương thức, đường dẫn và vị trí, để request của nhóm thật không bị handler giả đứng sau bắt nhầm
 * (vd /forms/mine của nhóm forms không rơi vào /forms/:code của nhóm form).
 * @param mockHandler  handler giả của nhóm đã dùng API thật
 * @returns            handler cùng đường dẫn, trả passthrough()
 */
function toPassthroughHandler(mockHandler: HttpHandler): HttpHandler {
  return new HttpHandler(mockHandler.info.method, mockHandler.info.path, () => passthrough());
}

/**
 * Dựng danh sách handler cho MSW.
 * @param realApiGroups  các nhóm dùng API thật
 * @returns              handler lỗi ngẫu nhiên đứng đầu, sau đó handler từng nhóm (giả, hoặc chuyển sang API thật)
 */
export function buildHandlers(realApiGroups: ReadonlySet<ApiGroup>): RequestHandler[] {
  // Nhóm thật: chuyển request đi tiếp · nhóm giả: giữ handler giả
  const orderedHandlers = HANDLER_GROUPS.flatMap(([group, groupHandlers]) =>
    realApiGroups.has(group) ? groupHandlers.map(toPassthroughHandler) : groupHandlers,
  );
  const mockedHandlers = new Set<RequestHandler>(
    HANDLER_GROUPS.flatMap(([group, groupHandlers]) => (realApiGroups.has(group) ? [] : groupHandlers)),
  );

  // Lỗi ngẫu nhiên đứng đầu: được xét trước handler thật của từng API
  return [createRandomFailureHandler(orderedHandlers, mockedHandlers), ...orderedHandlers];
}

export const handlers = buildHandlers(REAL_API_GROUPS);
