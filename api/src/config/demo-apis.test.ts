import { describe, expect, it } from 'vitest';
import { COMMON_MESSAGES } from '@ulaw/shared';
import { DEMO_APIS, realApiNotBuilt, usesDemoApi } from './demo-apis';

describe('usesDemoApi', () => {
  it('bật ENABLE_DEMO_APIS: dùng bản giả, trừ API trong ALWAYS_REAL_APIS', () => {
    expect(usesDemoApi(true, 'dev-login', new Set())).toBe(true);
    expect(usesDemoApi(true, 'dev-login', new Set(['dev-login']))).toBe(false);
  });

  it('tắt ENABLE_DEMO_APIS: luôn dùng bản thật', () => {
    expect(usesDemoApi(false, 'dev-login', new Set())).toBe(false);
  });

  it('API giả nào cũng có tên bắt đầu bằng dev-', () => {
    for (const api of DEMO_APIS) expect(api).toMatch(/^dev-/);
  });

  it('bản thật chưa phát triển: lỗi 501 nêu tên API', () => {
    const error = realApiNotBuilt('dev-student-directory');
    expect(error.getStatus()).toBe(501);
    expect(error.message).toBe(COMMON_MESSAGES.realApiNotBuilt('dev-student-directory'));
  });
});
