import { describe, expect, test } from 'vitest';
import type { RequestHandler } from 'msw';
import { buildHandlers } from './index';

const ORIGIN = 'http://localhost:5173';

/** Mọi handler giả gốc (khi không nhóm nào dùng API thật), để biết handler khớp là giả hay chuyển đi tiếp. */
const MOCK_HANDLERS = new Set(buildHandlers(new Set()).slice(1));

/**
 * Cho một request đi qua danh sách handler như MSW, xem nó bị trả lời giả hay được chuyển sang API thật.
 * @param orderedHandlers  kết quả buildHandlers(), bỏ handler lỗi ngẫu nhiên đứng đầu
 * @param method           phương thức HTTP
 * @param path             đường dẫn, vd '/api/health'
 * @returns                'passthrough' (đi tiếp ra backend) · 'mock' (API giả trả lời) · 'unhandled' (không handler nào khớp)
 */
async function routeOf(
  orderedHandlers: readonly RequestHandler[],
  method: string,
  path: string,
): Promise<'passthrough' | 'mock' | 'unhandled'> {
  // Tìm handler khớp đầu tiên, theo thứ tự (Node không có location nên phải tự đưa gốc để khớp đường dẫn /api/...)
  const request = new Request(`${ORIGIN}${path}`, { method });
  const resolutionContext = { baseUrl: ORIGIN };
  let matchedHandler: RequestHandler | undefined;
  for (const handler of orderedHandlers) {
    if (await handler.test({ request, resolutionContext })) {
      matchedHandler = handler;
      break;
    }
  }
  if (!matchedHandler) return 'unhandled';

  // Handler giả là chính handler gốc của nhóm; handler chuyển đi tiếp là handler mới tạo
  return MOCK_HANDLERS.has(matchedHandler) ? 'mock' : 'passthrough';
}

describe('buildHandlers', () => {
  test('không có nhóm thật: mọi nhóm vẫn dùng API giả', async () => {
    const [, ...orderedHandlers] = buildHandlers(new Set());
    expect(await routeOf(orderedHandlers, 'GET', '/api/health')).toBe('mock');
  });

  test('nhóm health thật: health đi ra backend, nhóm khác vẫn giả', async () => {
    const [, ...orderedHandlers] = buildHandlers(new Set(['health']));
    expect(await routeOf(orderedHandlers, 'GET', '/api/health')).toBe('passthrough');
    expect(await routeOf(orderedHandlers, 'GET', '/api/form-types/open')).toBe('mock');
  });

  test('nhóm forms thật, form giả: /forms/mine đi ra backend, không rơi vào /forms/:code của nhóm form', async () => {
    const [, ...orderedHandlers] = buildHandlers(new Set(['forms']));
    expect(await routeOf(orderedHandlers, 'GET', '/api/forms/mine')).toBe('passthrough');
    expect(await routeOf(orderedHandlers, 'GET', '/api/forms/XMM-2026-001-00001')).toBe('mock');
  });
});
