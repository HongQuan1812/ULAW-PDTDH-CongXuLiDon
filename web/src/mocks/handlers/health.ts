import { http, HttpResponse } from 'msw';

/* Kiểm tra API có trả lời không. Backend thật cũng nên có GET /api/health. */
export const healthHandlers = [
  http.get('/api/health', () => HttpResponse.json({ ok: true, mock: true })),
];
