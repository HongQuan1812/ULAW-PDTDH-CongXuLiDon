/* API giả: nội dung tệp đính kèm (xem trước, tải về). */
import { delay, http, HttpResponse } from 'msw';
import { ENDPOINTS, FILE_MESSAGES } from '@ulaw/shared';
import { getFileContent, readSession } from '../db';
import { MOCK_DELAY_MS, api, apiError } from '../http';

export const fileHandlers = [
  // Nội dung một tệp: người nộp đơn chứa tệp, hoặc cán bộ được xem mọi đơn
  http.get(api(ENDPOINTS.files.content), async ({ params }) => {
    await delay(MOCK_DELAY_MS);
    const session = await readSession();
    if (!session) return apiError(401, FILE_MESSAGES[401]);
    const file = getFileContent(String(params.fileId), { id: session.user.id, role: session.role });
    if (!file) return apiError(404, FILE_MESSAGES.notFound);
    return new HttpResponse(await file.arrayBuffer(), {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      },
    });
  }),
];
